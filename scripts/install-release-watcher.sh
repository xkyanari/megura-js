#!/usr/bin/env bash
# Sets up automatic deploys of new GitHub releases on this server. Run it once
# with sudo, from any directory, by a user who can run docker through sudo:
#
#   sudo bash /path/to/megura-js/scripts/install-release-watcher.sh
#
# It installs scripts/release-watch.sh as /usr/local/sbin/megura-watch (owned
# by root, so the checkout's owner can't change what root runs), writes its
# settings to /etc/megura/watch.env, and starts a systemd timer that runs it
# every 5 minutes. Run it again after a release changes release-watch.sh; the
# settings are kept. See "Automatic updates" in README.md.

set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "Run this with sudo." >&2; exit 1; }
REPO_DIR=$(cd "$(dirname "$0")/.." && pwd -P)
OWNER=$(stat -c %U "$REPO_DIR")
ENV_FILE=/etc/megura/watch.env
owner_git() { runuser -u "$OWNER" -- env HOME="$(getent passwd "$OWNER" | cut -d: -f6)" git -C "$REPO_DIR" "$@"; }

for tool in docker git curl python3 flock runuser systemctl; do
	command -v "$tool" >/dev/null || { echo "$tool isn't installed." >&2; exit 1; }
done

ORIGIN=$(owner_git remote get-url origin)
GITHUB_REPO=$(sed -nE 's#^(https://github\.com/|git@github\.com:)([^/]+/[^/]+)/?$#\2#p' <<<"$ORIGIN")
GITHUB_REPO=${GITHUB_REPO%.git}
[ -n "$GITHUB_REPO" ] || { echo "origin ($ORIGIN) isn't a GitHub repository." >&2; exit 1; }

echo "Checkout:   $REPO_DIR (owner: $OWNER)"
echo "Repository: $GITHUB_REPO"
echo "Installing: scripts/release-watch.sh from $(owner_git log -1 --format='%h %s')"
if [ -n "$(owner_git status --porcelain -- scripts/release-watch.sh)" ]; then
	echo "scripts/release-watch.sh has local changes; installing only what's committed on GitHub. Discard them first (git checkout scripts/release-watch.sh)." >&2
	exit 1
fi

install -d -o root -g root -m 755 /usr/local/sbin
install -d -o root -g root -m 700 /etc/megura /var/lib/megura
# taken from git, not the working tree, so it's exactly the committed file
owner_git show HEAD:scripts/release-watch.sh > /usr/local/sbin/megura-watch.new
chown root:root /usr/local/sbin/megura-watch.new
chmod 755 /usr/local/sbin/megura-watch.new
mv /usr/local/sbin/megura-watch.new /usr/local/sbin/megura-watch

# keep an existing webhook URL and token when re-run
WEBHOOK="" TOKEN=""
if [ -f "$ENV_FILE" ]; then
	# shellcheck disable=SC1090
	WEBHOOK=$(. "$ENV_FILE"; echo "${DISCORD_WEBHOOK_URL:-}")
	# shellcheck disable=SC1090
	TOKEN=$(. "$ENV_FILE"; echo "${GITHUB_TOKEN:-}")
fi
if [ -z "$WEBHOOK" ] && [ -t 0 ]; then
	echo
	echo "Deploy results are posted to a Discord channel through a webhook"
	echo "(channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL)."
	read -r -p "Webhook URL (leave empty to skip): " WEBHOOK
fi
if [ -n "$WEBHOOK" ] && ! [[ "$WEBHOOK" =~ ^https://(discord\.com|discordapp\.com|canary\.discord\.com|ptb\.discord\.com)/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$ ]]; then
	echo "That doesn't look like a Discord webhook URL; leaving it out. Re-run this to try again." >&2
	WEBHOOK=""
fi

umask 077
{
	echo "# Settings for /usr/local/sbin/megura-watch, written by scripts/install-release-watcher.sh"
	printf 'REPO_DIR=%q\n' "$REPO_DIR"
	printf 'DEPLOY_OWNER=%q\n' "$OWNER"
	printf 'GITHUB_REPO=%q\n' "$GITHUB_REPO"
	echo "DEPLOY_BRANCH=main"
	echo "TESTS_WORKFLOW=Tests"
	printf 'DISCORD_WEBHOOK_URL=%q\n' "$WEBHOOK"
	echo "# only needed if GitHub's rate limit for anonymous requests is hit"
	printf 'GITHUB_TOKEN=%q\n' "$TOKEN"
} > "$ENV_FILE.new"
mv "$ENV_FILE.new" "$ENV_FILE"

cat > /etc/systemd/system/megura-watch.service <<EOF
[Unit]
Description=Deploy new releases of the megura-js bot
Documentation=file://$REPO_DIR/README.md
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/megura-watch
# an update builds an image and waits for the bot; give it time
TimeoutStartSec=30min
Nice=5
EOF

cat > /etc/systemd/system/megura-watch.timer <<'EOF'
[Unit]
Description=Check for new megura-js releases every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=30s

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now megura-watch.timer >/dev/null

echo
echo "Installed /usr/local/sbin/megura-watch (sha256 $(sha256sum /usr/local/sbin/megura-watch | cut -c1-12))."
echo "Settings: $ENV_FILE. Timer: $(systemctl is-active megura-watch.timer)."
if [ -n "$WEBHOOK" ]; then
	/usr/local/sbin/megura-watch --test-notify || echo "Posting to the webhook failed; check the URL in $ENV_FILE." >&2
else
	echo "No Discord webhook: results only go to the journal (journalctl -u megura-watch)."
fi
echo
echo "Check it with:  sudo megura-watch --status"
echo "Follow it with: journalctl -u megura-watch -f"
