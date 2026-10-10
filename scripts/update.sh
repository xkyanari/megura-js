#!/usr/bin/env bash
# Updates the bot on this server to the latest main, in one command:
#
#   bash scripts/update.sh            # update if main has new commits
#   bash scripts/update.sh <commit>   # update to that commit of main (what CI tested)
#   bash scripts/update.sh --force    # run every step even if nothing is new
#
# On a server where the checkout's owner can't run docker, root runs it with
# DEPLOY_OWNER=<owner>: git and every file it writes (logs, backups) then go
# through that user, so nothing in the checkout becomes root's.
# scripts/release-watch.sh does this when a release is published.
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
# See "Updating" and "Automatic updates" in README.md.

set -euo pipefail
# REPO_DIR: the checkout, when this runs from a copy outside it (release-watch.sh)
cd "${REPO_DIR:-$(dirname "$0")/..}"

BRANCH="${DEPLOY_BRANCH:-main}"
IMAGE="megura-bot"
CONTAINER="megura-bot"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
HEALTH_POLL="${HEALTH_POLL:-5}"
# an image without a HEALTHCHECK only has to stay up this long
HEALTH_WAIT="${HEALTH_WAIT:-20}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
PREFLIGHT="${PREFLIGHT:-scripts/docker-preflight.sh}"
FORCE=false
TARGET=""
for arg in "$@"; do
	case "$arg" in
		--force) FORCE=true ;;
		*) TARGET="$arg" ;;
	esac
done

# Runs a command as DEPLOY_OWNER when this runs as root, otherwise as is.
OWNER="${DEPLOY_OWNER:-}"
if [ "$(id -u)" = 0 ] && [ -n "$OWNER" ] && [ "$OWNER" != root ]; then
	OWNER_HOME=$(getent passwd "$OWNER" | cut -d: -f6)
	[ -n "$OWNER_HOME" ] || { echo "No such user: $OWNER" >&2; exit 1; }
	as_owner() { runuser -u "$OWNER" -- env HOME="$OWNER_HOME" "$@"; }
else
	as_owner() { "$@"; }
fi
git() { as_owner env git "$@"; }
# always this file: a docker-compose.override.yml lying around is ignored
compose() { docker compose -f docker-compose.yml "$@"; }

as_owner mkdir -p logs backups
as_owner touch logs/update.lock
exec 9>>logs/update.lock
if ! flock -n 9; then
	echo "Another update is already running." >&2
	exit 1
fi
exec > >(as_owner tee -a logs/update.log) 2>&1

step() { printf '\n[%s] %s\n' "$(date -u '+%F %T UTC')" "$*"; }
die() { printf '[%s] FAILED: %s\n' "$(date -u '+%F %T UTC')" "$*" >&2; exit 1; }

step "Checking for updates on $BRANCH"
git fetch --quiet origin "$BRANCH"
OLD=$(git rev-parse HEAD)
if [ -n "$TARGET" ]; then
	# deploy exactly the commit that was tested, never a newer untested one
	[[ "$TARGET" =~ ^[0-9a-f]{7,40}$ ]] || die "not a commit ID: $TARGET"
	NEW=$(git rev-parse --verify --quiet "$TARGET^{commit}") || die "commit $TARGET isn't in this checkout's history (git fetch)"
	git merge-base --is-ancestor "$NEW" "origin/$BRANCH" || die "commit $TARGET isn't on $BRANCH"
	if git merge-base --is-ancestor "$NEW" "$OLD" && [ "$FORCE" = false ]; then
		echo "Already running $(git log -1 --format='%h %s'), which includes $(git rev-parse --short "$NEW")."
		exit 0
	fi
else
	NEW=$(git rev-parse "origin/$BRANCH")
fi
if [ "$OLD" = "$NEW" ] && [ "$FORCE" = false ]; then
	echo "Already up to date ($(git log -1 --format='%h %s'))."
	exit 0
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
	die "this checkout has local changes to tracked files; commit or discard them first (git status)"
fi
git merge --quiet --ff-only "$NEW" || die "can't fast-forward to $(git rev-parse --short "$NEW") (local commits?)"
echo "$(git log -1 --format='%h' "$OLD") → $(git log -1 --format='%h %s')"

# Puts the previous code back (the database is left as it is).
revert_code() {
	git reset --quiet --keep "$OLD" && echo "Code is back at $(git log -1 --format='%h %s')."
}

# The image the bot is running now: the one to go back to, whatever
# :latest says (an earlier update may have built an image it never started).
RUNNING_IMAGE=$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)

# Points :latest back at the running image, so nothing starts the new build by accident.
restore_latest() {
	if [ -n "$RUNNING_IMAGE" ]; then docker tag "$RUNNING_IMAGE" "$IMAGE:latest"; fi
}

# Starts the previous image again, if there is one.
start_previous() {
	revert_code
	if [ -n "$RUNNING_IMAGE" ]; then
		restore_latest
		compose up -d --no-build && echo "The previous version is running again."
	fi
}

step "Pre-flight check"
if ! bash "$PREFLIGHT"; then
	revert_code
	die "the pre-flight check found problems (listed above); the bot was not touched"
fi

step "Building the new image (the bot keeps running)"
if [ -n "$RUNNING_IMAGE" ]; then docker tag "$RUNNING_IMAGE" "$IMAGE:previous"; fi
if ! compose build; then
	restore_latest
	revert_code
	die "the build failed; the bot was not touched"
fi

step "Backing up the database"
config() { python3 -c "import json, sys; c = json.load(open('config.json')); print(c.get(sys.argv[1]) or sys.argv[2])" "$1" "${2:-}"; }
if ! { DB_HOST=$(config mysql_host 127.0.0.1) && DB_PORT=$(config mysql_port 3306) && DB_USER=$(config mysql_dbuser) \
	&& DB_NAME=$(config mysql_dbname) && DB_PASS=$(config mysql_dbpass); }; then
	restore_latest
	revert_code
	die "couldn't read the database settings from config.json"
fi
DUMP=$(command -v mysqldump || command -v mariadb-dump || true)
[ -n "$DUMP" ] || { restore_latest; revert_code; die "mysqldump (or mariadb-dump) isn't installed; install mysql-client, or the backup can't be made"; }
BACKUP="backups/$DB_NAME-$(date -u '+%Y%m%d-%H%M%S')-$(git rev-parse --short "$OLD").sql.gz"
# the password goes through the environment, never on the command line
if ! MYSQL_PWD="$DB_PASS" "$DUMP" --single-transaction --no-tablespaces --routines \
	-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" | gzip | as_owner sh -c 'umask 077 && cat > "$1"' sh "$BACKUP"; then
	rm -f "$BACKUP"
	restore_latest
	revert_code
	die "the backup failed; the bot was not touched"
fi
echo "Saved $BACKUP ($(du -h "$BACKUP" | cut -f1))."
{ ls -1t backups/*.sql.gz 2>/dev/null || true; } | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f

step "Stopping the bot"
compose down

step "Running database migrations"
if ! compose run --rm bot node scripts/migrate.js; then
	start_previous
	die "a migration failed. The database backup from just before is $BACKUP (restore: gunzip -c $BACKUP | mysql -u $DB_USER -p $DB_NAME)"
fi

step "Registering slash commands"
COMMANDS_OK=true
compose run --rm bot node deploy.js || COMMANDS_OK=false

step "Starting the bot and waiting for it to be healthy (up to ${HEALTH_TIMEOUT}s)"
compose up -d --no-build
# healthy: the container's HEALTHCHECK passes, i.e. the bot is logged in to
# Discord (functions/health.js). A crash, a restart or "unhealthy" fails at once.
HEALTHY=false
STARTED=$SECONDS
while :; do
	STATE=$(docker inspect -f '{{.State.Running}} {{.RestartCount}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || echo "false 0 none")
	read -r RUNNING RESTARTS HEALTH <<<"$STATE"
	if [ "$RUNNING" != "true" ] || [ "$RESTARTS" != "0" ] || [ "$HEALTH" = "unhealthy" ]; then break; fi
	if [ "$HEALTH" = "healthy" ]; then HEALTHY=true; break; fi
	if [ "$HEALTH" = "none" ] && [ $((SECONDS - STARTED)) -ge "$HEALTH_WAIT" ]; then HEALTHY=true; break; fi
	if [ $((SECONDS - STARTED)) -ge "$HEALTH_TIMEOUT" ]; then HEALTH="still ${HEALTH} after ${HEALTH_TIMEOUT}s"; break; fi
	sleep "$HEALTH_POLL"
done
if [ "$HEALTHY" = false ]; then
	echo "State: running=$RUNNING restarts=$RESTARTS health=$HEALTH"
	compose logs --tail 40 bot || true
	compose down || true
	start_previous
	die "the new version didn't become healthy (logs above). Migrations already ran; the backup from before them is $BACKUP"
fi
echo "Running $(git log -1 --format='%h %s')."

docker image prune -f >/dev/null || true

if [ "$COMMANDS_OK" = false ]; then
	die "the bot is running, but registering slash commands failed (see above); retry with: docker compose -f docker-compose.yml run --rm bot node deploy.js"
fi
step "Update complete"
