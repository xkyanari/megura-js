#!/usr/bin/env bash
# Checks that this server is ready to run the bot with Docker Compose.
# Run from the repository root after `git pull`, before stopping pm2:
#
#   bash scripts/docker-preflight.sh
#
# It changes nothing. Each problem is printed with the command that fixes it.

set -u
cd "$(dirname "$0")/.." || exit 1

APP_UID=1000 # the `node` user the container runs as
fails=0
warns=0

ok() { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; warns=$((warns + 1)); }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fails=$((fails + 1)); }
fix() { printf '        fix: %s\n' "$1"; }

# json_get FILE KEY -> prints the value (empty if missing); exits non-zero on invalid JSON
json_get() {
	python3 - "$1" "$2" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception as error:
    print(error, file=sys.stderr)
    sys.exit(2)
value = data.get(sys.argv[2], '')
print('' if value is None else value)
PY
}

# readable_by_app FILE -> true if uid 1000 can read it (owner, group or other)
readable_by_app() {
	local uid gid mode
	read -r uid gid mode < <(stat -c '%u %g %a' "$1")
	mode=$((8#$mode))
	{ [ "$uid" -eq "$APP_UID" ] && (( mode & 0400 )); } \
		|| { [ "$gid" -eq "$APP_UID" ] && (( mode & 0040 )); } \
		|| (( mode & 0004 ))
}

check_file() {
	local file=$1 example=$2
	if [ -d "$file" ]; then
		fail "$file is a directory (left behind by an earlier docker run)"
		fix "sudo rm -r $file && cp $example $file   # then fill it in"
	elif [ ! -f "$file" ]; then
		fail "$file is missing"
		fix "cp $example $file   # then fill it in"
	elif [ ! -r "$file" ]; then
		fail "$file can't be read by $(whoami), so it can't be checked"
		fix "sudo chown $APP_UID:$APP_UID $file && chmod 600 $file   (or re-run this script with sudo)"
	elif ! json_get "$file" _ >/dev/null 2>&1; then
		fail "$file is not valid JSON"
	elif ! readable_by_app "$file"; then
		fail "$file can't be read by the container user (uid $APP_UID)"
		fix "sudo chown $APP_UID:$APP_UID $file && chmod 600 $file"
	else
		ok "$file present, valid and readable by the container"
	fi
}

tcp_open() { timeout 3 bash -c "exec 3<>/dev/tcp/$1/$2" 2>/dev/null; }

if ! command -v python3 >/dev/null 2>&1; then
	echo "This script needs python3 to read the JSON config: sudo apt install python3"
	exit 1
fi

echo "Docker"
if ! command -v docker >/dev/null 2>&1; then
	fail "docker is not installed"
	fix "see 'Installing Docker' in README.md"
else
	if docker info >/dev/null 2>&1; then
		ok "Docker daemon is running"
	else
		fail "can't talk to the Docker daemon"
		fix "sudo systemctl enable --now docker   (and run this script with sudo, or add yourself to the docker group)"
	fi
	compose=$(docker compose version --short 2>/dev/null | sed 's/^v//')
	if [ -z "$compose" ]; then
		fail "Docker Compose v2 plugin is missing"
		fix "sudo apt install docker-compose-plugin   (from Docker's apt repository, see README.md)"
	elif [ "$(printf '%s\n2.24.0\n' "$compose" | sort -V | head -1)" != "2.24.0" ]; then
		fail "Docker Compose $compose is too old (needs 2.24 or later)"
		fix "install Docker from Docker's apt repository, see README.md"
	else
		ok "Docker Compose $compose"
	fi
	if systemctl is-enabled docker >/dev/null 2>&1; then
		ok "Docker starts on boot"
	else
		warn "Docker is not enabled at boot, so the bot won't come back after a reboot"
		fix "sudo systemctl enable docker"
	fi
fi

echo "Configuration"
check_file config.json config-example.json
check_file assets/features.json assets/features-example.json

# New features ship with a flag in features-example.json; a flag missing from
# features.json counts as "off", so the feature stays disabled on every tier.
if [ -f assets/features.json ] && [ -r assets/features.json ]; then
	missing=$(python3 - assets/features.json assets/features-example.json <<'PY' 2>/dev/null
import json, sys
current, example = (json.load(open(path)) for path in sys.argv[1:3])
for tier, flags in example.items():
    gaps = [flag for flag in flags if flag not in current.get(tier, {})]
    if gaps:
        print(f"{tier}: {', '.join(gaps)}")
PY
	)
	if [ -n "$missing" ]; then
		warn "assets/features.json is missing flags from features-example.json (treated as off):"
		printf '%s\n' "$missing" | sed 's/^/        /'
		fix "copy those keys from assets/features-example.json and set each to true or false"
	else
		ok "assets/features.json has every flag in features-example.json"
	fi
fi

if [ -f config.json ] && json_get config.json token >/dev/null 2>&1; then
	token=$(json_get config.json token)
	env_token=$(grep -s '^DISCORD_TOKEN=.' .env)
	if [ -n "$token" ] || [ -n "$env_token" ]; then
		ok "Discord token set ($([ -n "$env_token" ] && echo .env || echo config.json))"
	else
		fail "no Discord token in config.json or .env"
		fix "echo 'DISCORD_TOKEN=...' > .env && chmod 600 .env"
	fi
	test_mode="$(json_get config.json testMode)"
	[ -n "$test_mode" ] || test_mode="$(json_get config.json isTestnet)"
	if [ "$test_mode" = "True" ] || [ "$test_mode" = "true" ]; then
		warn "testMode is true in config.json; production should use false"
	fi
	for key in clientId mysql_dbname mysql_dbuser; do
		[ -n "$(json_get config.json "$key")" ] || fail "config.json: $key is empty"
	done

	echo "Services on this host"
	db_host=$(json_get config.json mysql_host); db_host=${db_host:-127.0.0.1}
	[ "$db_host" = "localhost" ] && db_host=127.0.0.1
	db_port=$(json_get config.json mysql_port); db_port=${db_port:-3306}
	if tcp_open "$db_host" "$db_port"; then
		ok "MySQL/MariaDB reachable at $db_host:$db_port"
	else
		fail "nothing listening at $db_host:$db_port (mysql_host/mysql_port in config.json)"
		fix "sudo systemctl status mariadb mysql"
	fi
	redis_url=$(json_get config.json redis_url); redis_url=${redis_url:-redis://127.0.0.1:6379}
	redis_hostport=${redis_url#*://}; redis_hostport=${redis_hostport#*@}; redis_hostport=${redis_hostport%%/*}
	if tcp_open "${redis_hostport%:*}" "${redis_hostport##*:}"; then
		ok "Redis reachable at $redis_hostport"
	else
		fail "nothing listening at $redis_hostport (redis_url in config.json, default 127.0.0.1:6379)"
		fix "sudo systemctl status redis-server"
	fi
fi

echo "Server resources"
mem_mb=$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)
swap_mb=$(awk '/SwapTotal/ { print int($2 / 1024) }' /proc/meminfo)
if [ "$mem_mb" -lt 3000 ] && [ "$swap_mb" -lt 1000 ]; then
	warn "${mem_mb} MB RAM and ${swap_mb} MB swap: builds can run the server out of memory"
	fix "add swap, see 'Small servers' in README.md"
else
	ok "${mem_mb} MB RAM, ${swap_mb} MB swap"
fi
free_mb=$(df -Pm . | awk 'NR == 2 { print $4 }')
if [ "$free_mb" -lt 2048 ]; then
	fail "only ${free_mb} MB free disk; the image and build need about 2 GB"
	fix "docker system prune -f, or free up space"
else
	ok "${free_mb} MB free disk"
fi

echo "Current deployment"
if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q '"status":"online"'; then
	warn "pm2 still has running apps; stop the bot in pm2 before 'docker compose up -d', or two copies will answer every command"
	pm2 list 2>/dev/null | sed 's/^/        /'
else
	ok "no running pm2 apps"
fi

echo
if [ "$fails" -gt 0 ]; then
	echo "$fails problem(s) to fix before switching to Docker ($warns warning(s))."
	exit 1
fi
echo "Ready to switch to Docker ($warns warning(s)). Next: see 'Switching from pm2' in README.md."
