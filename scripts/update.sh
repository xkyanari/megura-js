#!/usr/bin/env bash
# Updates the bot on this server to the latest main, in one command:
#
#   bash scripts/update.sh            # update if main has new commits
#   bash scripts/update.sh --force    # run every step even if nothing is new
#
# Steps: pull → pre-flight check → build the new image (the old bot keeps
# running) → back up the database → stop the bot → run new migrations →
# register slash commands → start the bot → check it stays up.
#
# If the build or the pre-flight check fails, nothing is stopped and the code
# goes back to where it was. If a migration fails, or the new bot doesn't stay
# up, the previous code and image are started again and the backup's path is
# printed. Everything is logged to logs/update.log.
#
# The GitHub "Deploy" workflow runs this over SSH when main goes green; see
# "Automatic updates" in README.md.

set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="${DEPLOY_BRANCH:-main}"
IMAGE="megura-bot"
CONTAINER="megura-bot"
HEALTH_WAIT="${HEALTH_WAIT:-20}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
PREFLIGHT="${PREFLIGHT:-scripts/docker-preflight.sh}"
FORCE=false
[ "${1:-}" = "--force" ] && FORCE=true

mkdir -p logs backups
exec 9>logs/update.lock
if ! flock -n 9; then
	echo "Another update is already running." >&2
	exit 1
fi
exec > >(tee -a logs/update.log) 2>&1

step() { printf '\n[%s] %s\n' "$(date -u '+%F %T UTC')" "$*"; }
die() { printf '[%s] FAILED: %s\n' "$(date -u '+%F %T UTC')" "$*" >&2; exit 1; }

step "Checking for updates on $BRANCH"
git fetch --quiet origin "$BRANCH"
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse "origin/$BRANCH")
if [ "$OLD" = "$NEW" ] && [ "$FORCE" = false ]; then
	echo "Already up to date ($(git log -1 --format='%h %s'))."
	exit 0
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
	die "this checkout has local changes to tracked files; commit or discard them first (git status)"
fi
git merge --quiet --ff-only "origin/$BRANCH" || die "can't fast-forward to origin/$BRANCH (local commits?)"
echo "$(git log -1 --format='%h' "$OLD") → $(git log -1 --format='%h %s')"

# Puts the previous code back (the database is left as it is).
revert_code() {
	git reset --quiet --keep "$OLD" && echo "Code is back at $(git log -1 --format='%h %s')."
}

# Starts the previous image again, if there is one.
start_previous() {
	revert_code
	if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
		docker tag "$IMAGE:previous" "$IMAGE:latest"
		docker compose up -d --no-build && echo "The previous version is running again."
	fi
}

step "Pre-flight check"
if ! bash "$PREFLIGHT"; then
	revert_code
	die "the pre-flight check found problems (listed above); the bot was not touched"
fi

step "Building the new image (the bot keeps running)"
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
	docker tag "$IMAGE:latest" "$IMAGE:previous"
fi
if ! docker compose build; then
	revert_code
	die "the build failed; the bot was not touched"
fi

step "Backing up the database"
config() { python3 -c "import json, sys; c = json.load(open('config.json')); print(c.get(sys.argv[1]) or sys.argv[2])" "$1" "${2:-}"; }
if ! { DB_HOST=$(config mysql_host 127.0.0.1) && DB_PORT=$(config mysql_port 3306) && DB_USER=$(config mysql_dbuser) \
	&& DB_NAME=$(config mysql_dbname) && DB_PASS=$(config mysql_dbpass); }; then
	revert_code
	die "couldn't read the database settings from config.json"
fi
DUMP=$(command -v mysqldump || command -v mariadb-dump || true)
[ -n "$DUMP" ] || { revert_code; die "mysqldump (or mariadb-dump) isn't installed; install mysql-client, or the backup can't be made"; }
BACKUP="backups/$DB_NAME-$(date -u '+%Y%m%d-%H%M%S')-$(git rev-parse --short "$OLD").sql.gz"
# the password goes through the environment, never on the command line
if ! MYSQL_PWD="$DB_PASS" "$DUMP" --single-transaction --no-tablespaces --routines \
	-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" | gzip > "$BACKUP"; then
	rm -f "$BACKUP"
	revert_code
	die "the backup failed; the bot was not touched"
fi
echo "Saved $BACKUP ($(du -h "$BACKUP" | cut -f1))."
{ ls -1t backups/*.sql.gz 2>/dev/null || true; } | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f

step "Stopping the bot"
docker compose down

step "Running database migrations"
if ! docker compose run --rm bot node scripts/migrate.js; then
	start_previous
	die "a migration failed. The database backup from just before is $BACKUP (restore: gunzip -c $BACKUP | mysql -u $DB_USER -p $DB_NAME)"
fi

step "Registering slash commands"
COMMANDS_OK=true
docker compose run --rm bot node deploy.js || COMMANDS_OK=false

step "Starting the bot"
docker compose up -d --no-build
sleep "$HEALTH_WAIT"
STATE=$(docker inspect -f '{{.State.Running}} {{.RestartCount}}' "$CONTAINER" 2>/dev/null || echo "false 0")
if [ "${STATE%% *}" != "true" ] || [ "${STATE##* }" != "0" ]; then
	docker compose logs --tail 40 bot || true
	docker compose down || true
	start_previous
	die "the new version didn't stay up (logs above). Migrations already ran; the backup from before them is $BACKUP"
fi
echo "Running $(git log -1 --format='%h %s')."

docker image prune -f >/dev/null || true

if [ "$COMMANDS_OK" = false ]; then
	die "the bot is running, but registering slash commands failed (see above); retry with: docker compose run --rm bot node deploy.js"
fi
step "Update complete"
