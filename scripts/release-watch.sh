#!/usr/bin/env bash
# Deploys new GitHub releases of the bot on this server. A systemd timer runs
# it every few minutes as root (scripts/install-release-watcher.sh sets it up):
#
#   megura-watch                 deploy the latest release if it's new
#   megura-watch --status        show the last result and the latest release
#   megura-watch --retry         try the latest release again after a failure
#   megura-watch --test-notify   send a test message to the Discord webhook
#
# For a new release (drafts and prereleases don't count), it:
#   1. fetches the release's tag, as the checkout's owner;
#   2. checks the tag's commit is on main and the Tests workflow passed on it
#      (still running: it checks again next time; failed: the release is skipped);
#   3. runs scripts/update.sh taken from that commit, which builds, backs up,
#      migrates, starts the bot and waits for it to be healthy, or rolls back;
#   4. records the result in /var/lib/megura and posts it to Discord.
# A release that failed or was skipped isn't tried again until a newer one is
# published, or someone runs --retry.
#
# Git always runs as the checkout's owner, and root only runs update.sh as it
# is in the release's commit, never the copy in the checkout.

set -euo pipefail

WATCH_ENV="${WATCH_ENV:-/etc/megura/watch.env}"
# shellcheck disable=SC1090
if [ -f "$WATCH_ENV" ]; then . "$WATCH_ENV"; fi

REPO_DIR="${REPO_DIR:?set REPO_DIR in $WATCH_ENV}"
GITHUB_REPO="${GITHUB_REPO:?set GITHUB_REPO (owner/name) in $WATCH_ENV}"
DEPLOY_OWNER="${DEPLOY_OWNER:-$(stat -c %U "$REPO_DIR")}"
BRANCH="${DEPLOY_BRANCH:-main}"
TESTS_WORKFLOW="${TESTS_WORKFLOW:-Tests}"
STATE_DIR="${STATE_DIR:-/var/lib/megura}"
GITHUB_API="${GITHUB_API:-https://api.github.com}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
STATE="$STATE_DIR/watch.state"

MODE=run
case "${1:-}" in
	'') ;;
	--status) MODE=status ;;
	--retry) MODE=retry ;;
	--test-notify) MODE=test-notify ;;
	*) echo "usage: $0 [--status | --retry | --test-notify]" >&2; exit 2 ;;
esac

if [ "$(id -u)" = 0 ] && [ "$DEPLOY_OWNER" != root ]; then
	OWNER_HOME=$(getent passwd "$DEPLOY_OWNER" | cut -d: -f6)
	as_owner() { runuser -u "$DEPLOY_OWNER" -- env HOME="$OWNER_HOME" "$@"; }
else
	as_owner() { "$@"; }
fi
git() { as_owner env git -C "$REPO_DIR" "$@"; }

umask 077
mkdir -p "$STATE_DIR"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

log() { printf '[%s] %s\n' "$(date -u '+%F %T UTC')" "$*"; }

# json FILE PYTHON-EXPRESSION: prints the expression, evaluated with d = the file's JSON
json() { python3 -c 'import json, sys; d = json.load(open(sys.argv[1])); r = eval(sys.argv[2]); print("" if r is None else r)' "$1" "$2"; }

# api PATH OUTFILE: GETs a GitHub API path and prints the HTTP status
api() {
	local args=(-sS -o "$2" -w '%{http_code}' --max-time 30 -H 'Accept: application/vnd.github+json' -H 'User-Agent: megura-watch')
	if [ -n "${GITHUB_TOKEN:-}" ]; then args+=(-H "Authorization: Bearer $GITHUB_TOKEN"); fi
	curl "${args[@]}" "$GITHUB_API/$1" || echo 000
}

# notify TEXT: posts to the Discord webhook, if one is set; never fails the run
notify() {
	[ -n "$DISCORD_WEBHOOK_URL" ] || return 0
	python3 -c 'import json, sys; t = sys.argv[1]; print(json.dumps({"content": t if len(t) <= 1900 else t[:1900] + "\n…", "allowed_mentions": {"parse": []}}))' "$1" \
		| curl -sS -o /dev/null --max-time 30 -H 'Content-Type: application/json' --data-binary @- "$DISCORD_WEBHOOK_URL" \
		|| log "couldn't post to the Discord webhook"
}

state_get() { if [ -f "$STATE" ]; then sed -n "s/^$1=//p" "$STATE" | tail -n 1; fi; }
# record TAG SHA RESULT
record() { printf 'tag=%s\nsha=%s\nresult=%s\nat=%s\n' "$1" "$2" "$3" "$(date -u '+%F %T UTC')" > "$STATE"; }

if [ "$MODE" = test-notify ]; then
	[ -n "$DISCORD_WEBHOOK_URL" ] || { echo "No DISCORD_WEBHOOK_URL in $WATCH_ENV." >&2; exit 1; }
	notify "🔔 megura-watch on $(hostname) can post here."
	echo "Sent."
	exit 0
fi

exec 8>>"$STATE_DIR/watch.lock"
if ! flock -n 8; then
	log "Another check is still running."
	exit 0
fi

CODE=$(api "repos/$GITHUB_REPO/releases/latest" "$WORK/release.json")
case "$CODE" in
	200) ;;
	404) TAG="" ;;
	*) log "GitHub answered $CODE for the latest release; trying again next time."; exit 1 ;;
esac
if [ "$CODE" = 200 ]; then
	TAG=$(json "$WORK/release.json" 'd["tag_name"]')
	RELEASE_URL=$(json "$WORK/release.json" 'd.get("html_url")')
fi

if [ "$MODE" = status ]; then
	if [ -f "$STATE" ]; then
		echo "Last release handled: $(state_get tag) ($(state_get sha | cut -c1-7)): $(state_get result), $(state_get at)"
	else
		echo "No release handled yet."
	fi
	echo "Latest release on GitHub: ${TAG:-none}"
	echo "Running: $(git log -1 --format='%h %s')"
	exit 0
fi

if [ -z "$TAG" ]; then
	log "$GITHUB_REPO has no releases yet."
	exit 0
fi
[[ "$TAG" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || { log "Ignoring a release with an odd tag name: $TAG"; exit 1; }

LAST_TAG=$(state_get tag)
LAST_RESULT=$(state_get result)
if [ "$TAG" = "$LAST_TAG" ]; then
	if [ "$MODE" = retry ] && [ "$LAST_RESULT" != deployed ]; then
		log "Retrying $TAG (last time: $LAST_RESULT)."
	else
		log "Nothing new: $TAG was already handled ($LAST_RESULT)."
		exit 0
	fi
fi

log "New release: $TAG"
git fetch --quiet origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" "+refs/tags/$TAG:refs/tags/$TAG"
SHA=$(git rev-parse --verify --quiet "refs/tags/$TAG^{commit}") || { log "Couldn't find the commit of tag $TAG."; exit 1; }
SHORT=${SHA:0:7}

if ! git merge-base --is-ancestor "$SHA" "origin/$BRANCH"; then
	record "$TAG" "$SHA" refused
	log "Release $TAG ($SHORT) isn't on $BRANCH; not deploying it."
	notify "⛔ Release **$TAG** (\`$SHORT\`) points at a commit that isn't on \`$BRANCH\`, so it wasn't deployed. ${RELEASE_URL}"
	exit 1
fi

# the newest run of the Tests workflow on exactly this commit
CODE=$(api "repos/$GITHUB_REPO/actions/runs?head_sha=$SHA&per_page=100" "$WORK/runs.json")
[ "$CODE" = 200 ] || { log "GitHub answered $CODE for the test runs; trying again next time."; exit 1; }
TESTS=$(python3 -c '
import json, sys
runs = [r for r in json.load(open(sys.argv[1]))["workflow_runs"] if r["name"] == sys.argv[2]]
if runs:
    r = max(runs, key=lambda r: r["created_at"])
    print(r["conclusion"] if r["status"] == "completed" else r["status"])
' "$WORK/runs.json" "$TESTS_WORKFLOW")
case "$TESTS" in
	success) log "$TESTS_WORKFLOW passed on $SHORT." ;;
	'' | queued | in_progress | waiting | pending | requested)
		log "$TESTS_WORKFLOW hasn't finished on $SHORT (${TESTS:-not started}); checking again next time."
		exit 0 ;;
	*)
		record "$TAG" "$SHA" skipped
		log "$TESTS_WORKFLOW didn't pass on $SHORT ($TESTS); not deploying $TAG."
		notify "⚠️ Release **$TAG** (\`$SHORT\`) wasn't deployed: the $TESTS_WORKFLOW workflow ended with \`$TESTS\`. Once it's fixed, publish a new release, or re-run the tests and run \`sudo megura-watch --retry\`. ${RELEASE_URL}"
		exit 1 ;;
esac

NOTE=""
if ! git show "$SHA:scripts/release-watch.sh" 2>/dev/null | cmp -s - "$0"; then
	NOTE=$'\n'"ℹ️ This release changes the watcher itself; to use the new one, run \`sudo bash $REPO_DIR/scripts/install-release-watcher.sh\`."
fi

FROM=$(git log -1 --format='%h')
git show "$SHA:scripts/update.sh" > "$WORK/update.sh"
log "Deploying $TAG ($SHORT) with scripts/update.sh from that commit."
set +e
REPO_DIR="$REPO_DIR" DEPLOY_OWNER="$DEPLOY_OWNER" bash "$WORK/update.sh" "$SHA" 2>&1 | tee "$WORK/update.out"
RC=${PIPESTATUS[0]}
set -e

if [ "$RC" = 0 ]; then
	record "$TAG" "$SHA" deployed
	log "Deployed $TAG."
	notify "✅ **$TAG** (\`$SHORT\`) is deployed and the bot is healthy (was \`$FROM\`). ${RELEASE_URL}${NOTE}"
else
	record "$TAG" "$SHA" failed
	log "Deploying $TAG failed; see above and $REPO_DIR/logs/update.log."
	TAIL=$({ grep -v '^\s*$' "$WORK/update.out" || true; } | tail -n 12 | cut -c1-200)
	notify "❌ Deploying **$TAG** (\`$SHORT\`) failed. The bot is on \`$(git log -1 --format='%h')\` (it was on \`$FROM\`). Last lines of the update:"$'\n```\n'"$TAIL"$'\n```\n'"Full log: \`$REPO_DIR/logs/update.log\`. Retry with \`sudo megura-watch --retry\`.${NOTE}"
	exit 1
fi
