const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');

/**
 * Runs scripts/update.sh against a throwaway git "server" checkout, with
 * docker and mysqldump replaced by stubs that log their arguments. Checks the
 * step order, that nothing is touched when there's nothing new, and that a
 * failed build, migration or start puts the previous version back.
 */

const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'update-sh-'));
const STUBS = path.join(tmp, 'bin');
const ORIGIN = path.join(tmp, 'origin.git');
const SEED = path.join(tmp, 'seed');
const SERVER = path.join(tmp, 'server');
const CALLS = path.join(tmp, 'docker-calls.log');
const DUMP_ENV = path.join(tmp, 'dump-env.log');

const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const stub = (name, body) => fs.writeFileSync(path.join(STUBS, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });

const pushCommit = (message) => {
	fs.writeFileSync(path.join(SEED, 'version.txt'), message);
	git(SEED, 'commit', '-qam', message);
	git(SEED, 'push', '-q', 'origin', 'main');
	return git(SEED, 'rev-parse', 'HEAD');
};

const update = (env = {}, args = []) => {
	fs.rmSync(CALLS, { force: true });
	const result = spawnSync('bash', ['scripts/update.sh', ...args], {
		cwd: SERVER,
		encoding: 'utf8',
		env: { ...gitEnv, PATH: `${STUBS}:${process.env.PATH}`, HEALTH_WAIT: '0', HEALTH_POLL: '0.1', PREFLIGHT: 'scripts/preflight-ok.sh', ...env },
	});
	const calls = fs.existsSync(CALLS) ? fs.readFileSync(CALLS, 'utf8').trim().split('\n') : [];
	return { ...result, output: result.stdout + result.stderr, calls };
};

before(() => {
	fs.mkdirSync(STUBS);
	// docker: logs each call; FAIL_BUILD / FAIL_MIGRATE / HEALTH_STATE steer it.
	// HEALTH_STATE is "running restarts health", as update.sh asks docker inspect.
	stub('docker', `echo "$*" >> ${JSON.stringify(CALLS)}
case "$*" in
	"compose -f docker-compose.yml build") [ -n "\${FAIL_BUILD:-}" ] && exit 1 ;;
	"compose -f docker-compose.yml run --rm bot node scripts/migrate.js") [ -n "\${FAIL_MIGRATE:-}" ] && exit 1 ;;
	"inspect -f {{.Image}} megura-bot") echo "sha256:old" ;;
	inspect*) echo "\${HEALTH_STATE:-true 0 healthy}" ;;
esac
exit 0`);
	stub('mysqldump', `[ -n "\${FAIL_DUMP:-}" ] && exit 1; echo "MYSQL_PWD=$MYSQL_PWD args=$*" > ${JSON.stringify(DUMP_ENV)}; echo "-- dump"`);

	execFileSync('git', ['init', '-q', '--bare', '-b', 'main', ORIGIN]);
	fs.mkdirSync(path.join(SEED, 'scripts'), { recursive: true });
	git(SEED, 'init', '-q', '-b', 'main');
	fs.copyFileSync(path.join(ROOT, 'scripts', 'update.sh'), path.join(SEED, 'scripts', 'update.sh'));
	fs.writeFileSync(path.join(SEED, 'scripts', 'preflight-ok.sh'), 'echo preflight ok\n');
	fs.writeFileSync(path.join(SEED, '.gitignore'), 'config.json\nlogs/\nbackups/\n');
	fs.writeFileSync(path.join(SEED, 'version.txt'), 'v1');
	git(SEED, 'add', '.');
	git(SEED, 'commit', '-qm', 'v1');
	git(SEED, 'remote', 'add', 'origin', ORIGIN);
	git(SEED, 'push', '-q', 'origin', 'main');
	git(tmp, 'clone', '-q', ORIGIN, SERVER);
	fs.writeFileSync(path.join(SERVER, 'config.json'), JSON.stringify({ mysql_dbname: 'megura', mysql_dbuser: 'bot', mysql_dbpass: 's3cret pass', mysql_host: '127.0.0.1', mysql_port: 3306 }));
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('scripts/update.sh', () => {
	test('nothing new: nothing is touched', () => {
		const run = update();
		assert.equal(run.status, 0, run.output);
		assert.match(run.output, /Already up to date/);
		assert.deepEqual(run.calls, []);
	});

	test('an update builds first, backs up, stops, migrates, registers commands and starts, in that order', () => {
		const head = pushCommit('v2');
		const run = update();
		assert.equal(run.status, 0, run.output);
		assert.equal(git(SERVER, 'rev-parse', 'HEAD'), head);
		const order = ['compose -f docker-compose.yml build', 'compose -f docker-compose.yml down', 'compose -f docker-compose.yml run --rm bot node scripts/migrate.js', 'compose -f docker-compose.yml run --rm bot node deploy.js', 'compose -f docker-compose.yml up -d --no-build'];
		const positions = order.map((call) => run.calls.indexOf(call));
		assert.ok(positions.every((p) => p >= 0), `all steps ran: ${run.calls.join(' | ')}`);
		assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'in order');
		assert.ok(run.calls.includes('tag sha256:old megura-bot:previous'), 'the old image is kept for rollback');

		// the backup: password only through the environment, never in arguments or the log
		const backups = fs.readdirSync(path.join(SERVER, 'backups'));
		assert.equal(backups.length, 1);
		assert.match(backups[0], /^megura-\d{8}-\d{6}-[0-9a-f]+\.sql\.gz$/);
		const dump = fs.readFileSync(DUMP_ENV, 'utf8');
		assert.match(dump, /^MYSQL_PWD=s3cret pass args=--single-transaction .*-u bot megura$/m);
		assert.ok(!dump.split('args=')[1].includes('s3cret'));
		assert.ok(!fs.readFileSync(path.join(SERVER, 'logs', 'update.log'), 'utf8').includes('s3cret'));
	});

	test('a failed build leaves the running bot alone and the code where it was', () => {
		const previous = git(SERVER, 'rev-parse', 'HEAD');
		pushCommit('v3-broken-build');
		const run = update({ FAIL_BUILD: '1' });
		assert.equal(run.status, 1);
		assert.match(run.output, /the build failed; the bot was not touched/);
		assert.equal(git(SERVER, 'rev-parse', 'HEAD'), previous);
		assert.ok(!run.calls.includes('compose -f docker-compose.yml down'));
	});

	test('a failed migration starts the previous version again and names the backup', () => {
		const previous = git(SERVER, 'rev-parse', 'HEAD');
		const run = update({ FAIL_MIGRATE: '1' });
		assert.equal(run.status, 1);
		assert.match(run.output, /a migration failed\. The database backup from just before is backups\/megura-/);
		assert.equal(git(SERVER, 'rev-parse', 'HEAD'), previous);
		assert.ok(run.calls.includes('tag sha256:old megura-bot:latest'));
		assert.equal(run.calls.at(-1), 'compose -f docker-compose.yml up -d --no-build');
		assert.ok(!run.calls.includes('compose -f docker-compose.yml run --rm bot node deploy.js'));
	});

	for (const [why, env] of [
		['keeps restarting', { HEALTH_STATE: 'true 3 starting' }],
		['is unhealthy', { HEALTH_STATE: 'true 0 unhealthy' }],
		['never becomes healthy', { HEALTH_STATE: 'true 0 starting', HEALTH_TIMEOUT: '1' }],
	]) {
		test(`a bot that ${why} is rolled back too`, () => {
			const previous = git(SERVER, 'rev-parse', 'HEAD');
			const run = update(env);
			assert.equal(run.status, 1);
			assert.match(run.output, /didn't become healthy/);
			assert.equal(git(SERVER, 'rev-parse', 'HEAD'), previous);
			assert.ok(run.calls.includes('tag sha256:old megura-bot:latest'));
		});
	}

	test('a failed backup leaves the running bot alone, and :latest back on the running image', () => {
		const previous = git(SERVER, 'rev-parse', 'HEAD');
		const run = update({ FAIL_DUMP: '1' });
		assert.equal(run.status, 1);
		assert.match(run.output, /the backup failed; the bot was not touched/);
		assert.equal(git(SERVER, 'rev-parse', 'HEAD'), previous);
		assert.equal(run.calls.at(-1), 'tag sha256:old megura-bot:latest');
		assert.ok(!run.calls.includes('compose -f docker-compose.yml down'));
	});

	test('an image without a healthcheck only has to stay up', () => {
		const run = update({ HEALTH_STATE: 'true 0 none' });
		assert.equal(run.status, 0, run.output);
		assert.equal(git(SERVER, 'rev-parse', 'HEAD'), git(SEED, 'rev-parse', 'HEAD'));
	});

	test('with a commit, exactly that commit is deployed, even when main has moved on', () => {
		update();
		const tested = pushCommit('v4-tested');
		pushCommit('v5-untested');
		const run = update({}, [tested]);
		assert.equal(run.status, 0, run.output);
		assert.equal(git(SERVER, 'rev-parse', 'HEAD'), tested);

		// a run for an older commit after a newer one went out doesn't go backwards
		const older = update({}, [git(SERVER, 'rev-parse', 'HEAD~1')]);
		assert.equal(older.status, 0);
		assert.match(older.output, /Already running/);
		assert.deepEqual(older.calls, [], 'nothing touched');
	});

	test('run from a copy outside the checkout, REPO_DIR points it at the checkout', () => {
		const tip = pushCommit('v6');
		const copy = path.join(tmp, 'update-copy.sh');
		fs.copyFileSync(path.join(SERVER, 'scripts', 'update.sh'), copy);
		fs.rmSync(CALLS, { force: true });
		const run = spawnSync('bash', [copy, tip], {
			cwd: tmp,
			encoding: 'utf8',
			env: { ...gitEnv, PATH: `${STUBS}:${process.env.PATH}`, HEALTH_POLL: '0.1', PREFLIGHT: 'scripts/preflight-ok.sh', REPO_DIR: SERVER },
		});
		assert.equal(run.status, 0, run.stdout + run.stderr);
		assert.equal(git(SERVER, 'rev-parse', 'HEAD'), tip);
	});

	test('only a commit ID on main is deployed', () => {
		const notOnMain = update({}, ['0123456789abcdef0123456789abcdef01234567']);
		assert.equal(notOnMain.status, 1);
		assert.match(notOnMain.output, /isn't in this checkout's history/);
		const junk = update({}, ['main; rm -rf /']);
		assert.equal(junk.status, 1);
		assert.match(junk.output, /not a commit ID/);
	});

	test('only one update runs at a time', () => {
		const holder = spawn('flock', [path.join(SERVER, 'logs', 'update.lock'), 'sleep', '5']);
		try {
			execFileSync('sleep', ['0.3']);
			const run = update();
			assert.equal(run.status, 1);
			assert.match(run.output, /Another update is already running/);
		}
		finally {
			holder.kill();
		}
	});
});
