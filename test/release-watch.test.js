const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

/**
 * Runs scripts/release-watch.sh against a throwaway git "server" checkout.
 * curl is a stub: GitHub API answers come from files the tests write, and
 * webhook posts are logged. The release commits carry a stub scripts/update.sh
 * that logs how it was called, which also checks the watcher runs update.sh
 * from the release's commit.
 */

const ROOT = path.resolve(__dirname, '..');
const WATCH = path.join(ROOT, 'scripts', 'release-watch.sh');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-watch-'));
const STUBS = path.join(tmp, 'bin');
const FAKE = path.join(tmp, 'github');
const ORIGIN = path.join(tmp, 'origin.git');
const SEED = path.join(tmp, 'seed');
const SERVER = path.join(tmp, 'server');
const STATE_DIR = path.join(tmp, 'state');
const UPDATE_LOG = path.join(tmp, 'update-calls.log');
const WEBHOOK_LOG = path.join(FAKE, 'webhook.log');

const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

const commit = (message) => {
	fs.writeFileSync(path.join(SEED, 'version.txt'), message);
	git(SEED, 'commit', '-qam', message);
	git(SEED, 'push', '-q', 'origin', 'HEAD');
	return git(SEED, 'rev-parse', 'HEAD');
};
const tag = (name, ref = 'HEAD') => {
	git(SEED, 'tag', name, ref);
	git(SEED, 'push', '-q', 'origin', name);
	return git(SEED, 'rev-parse', `${name}^{commit}`);
};
const release = (tagName) => fs.writeFileSync(path.join(FAKE, 'release.json'), JSON.stringify({ tag_name: tagName, html_url: `https://github.test/releases/${tagName}` }));
// runs: [[status, conclusion, created_at, name?], ...]
const testRuns = (runs) => fs.writeFileSync(path.join(FAKE, 'runs.json'), JSON.stringify({
	workflow_runs: runs.map(([status, conclusion, created, name = 'Tests']) => ({ name, status, conclusion, created_at: created })),
}));

const watch = (args = [], env = {}) => {
	fs.rmSync(UPDATE_LOG, { force: true });
	fs.rmSync(WEBHOOK_LOG, { force: true });
	const result = spawnSync('bash', [WATCH, ...args], {
		cwd: tmp,
		encoding: 'utf8',
		env: {
			...gitEnv, PATH: `${STUBS}:${process.env.PATH}`, WATCH_ENV: path.join(tmp, 'none.env'),
			REPO_DIR: SERVER, GITHUB_REPO: 'owner/megura-js', STATE_DIR, DISCORD_WEBHOOK_URL: 'https://discord.test/hook', UPDATE_LOG,
			...env,
		},
	});
	const updates = read(UPDATE_LOG).trim().split('\n').filter(Boolean);
	const posts = read(WEBHOOK_LOG).split('\n').filter(Boolean).map((line) => JSON.parse(line));
	// webhook: the messages' text, as Discord shows it
	return { ...result, output: result.stdout + result.stderr, updates, posts, webhook: posts.map((p) => p.content).join('\n') };
};
const state = () => read(path.join(STATE_DIR, 'watch.state'));

before(() => {
	fs.mkdirSync(STUBS);
	fs.mkdirSync(FAKE);
	// curl: GitHub API paths answer from files in FAKE (404 when missing); anything else is the webhook
	fs.writeFileSync(path.join(STUBS, 'curl'), `#!/usr/bin/env bash
out=/dev/null; url=""
while [ $# -gt 0 ]; do
	case "$1" in
		-o) out="$2"; shift ;;
		-H|-w|--max-time|--data-binary) shift ;;
		-*) ;;
		*) url="$1" ;;
	esac
	shift
done
case "$url" in
	*/releases/latest) file=${JSON.stringify(FAKE)}/release.json ;;
	*/actions/runs*) file=${JSON.stringify(FAKE)}/runs.json ;;
	*) { cat; echo; } >> ${JSON.stringify(WEBHOOK_LOG)}; exit 0 ;;
esac
if [ -f "$file" ]; then cp "$file" "$out"; printf 200; else echo '{}' > "$out"; printf 404; fi
`, { mode: 0o755 });

	execFileSync('git', ['init', '-q', '--bare', '-b', 'main', ORIGIN]);
	fs.mkdirSync(path.join(SEED, 'scripts'), { recursive: true });
	git(SEED, 'init', '-q', '-b', 'main');
	fs.writeFileSync(path.join(SEED, 'scripts', 'update.sh'), 'echo "update $* repo=$REPO_DIR owner=$DEPLOY_OWNER" >> "$UPDATE_LOG"\n[ -n "${FAIL_UPDATE:-}" ] && { echo "FAILED: the new version did not become healthy"; exit 1; }\n# like update.sh: moves to the commit, or leaves a checkout that already has it alone\ngit -C "$REPO_DIR" merge -q --ff-only "$1"\n');
	fs.copyFileSync(WATCH, path.join(SEED, 'scripts', 'release-watch.sh'));
	fs.writeFileSync(path.join(SEED, 'version.txt'), 'v0');
	git(SEED, 'add', '.');
	git(SEED, 'commit', '-qm', 'v0');
	git(SEED, 'remote', 'add', 'origin', ORIGIN);
	git(SEED, 'push', '-q', 'origin', 'main');
	git(tmp, 'clone', '-q', ORIGIN, SERVER);
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('scripts/release-watch.sh', () => {
	test('no release yet: nothing happens', () => {
		const run = watch();
		assert.equal(run.status, 0, run.output);
		assert.match(run.output, /no releases yet/);
		assert.deepEqual(run.updates, []);
		assert.equal(state(), '');
	});

	test('tests still running (or not started): it waits and records nothing', () => {
		commit('v1');
		tag('v1.0.0');
		release('v1.0.0');
		fs.rmSync(path.join(FAKE, 'runs.json'), { force: true });
		testRuns([]);
		let run = watch();
		assert.equal(run.status, 0, run.output);
		assert.match(run.output, /hasn't finished .*not started/);

		testRuns([['in_progress', null, '2026-10-10T01:00:00Z']]);
		run = watch();
		assert.equal(run.status, 0, run.output);
		assert.match(run.output, /hasn't finished .*in_progress/);
		assert.deepEqual(run.updates, []);
		assert.equal(run.webhook, '');
		assert.equal(state(), '');
	});

	test('tests green: update.sh from the release\'s commit deploys exactly that commit, and it\'s announced', () => {
		const sha = git(SEED, 'rev-parse', 'v1.0.0^{commit}');
		// an older failed run doesn't count once a newer one passed; other workflows are ignored
		testRuns([['completed', 'failure', '2026-10-10T01:00:00Z'], ['completed', 'success', '2026-10-10T02:00:00Z'], ['completed', 'failure', '2026-10-10T03:00:00Z', 'Lint']]);
		const run = watch();
		assert.equal(run.status, 0, run.output);
		assert.deepEqual(run.updates, [`update ${sha} repo=${SERVER} owner=${os.userInfo().username}`]);
		assert.match(state(), /^tag=v1\.0\.0$/m);
		assert.match(state(), /^result=deployed$/m);
		assert.match(run.webhook, /✅ \*\*v1\.0\.0\*\*/);
		assert.ok(!run.webhook.includes('changes the watcher itself'), 'same watcher: no reinstall note');
		// mentions can't ping anyone
		assert.deepEqual(run.posts[0].allowed_mentions, { parse: [] });
	});

	test('the same release again: nothing happens', () => {
		const run = watch();
		assert.equal(run.status, 0, run.output);
		assert.match(run.output, /Nothing new: v1\.0\.0 was already handled \(deployed\)/);
		assert.deepEqual(run.updates, []);
		assert.equal(run.webhook, '');
	});

	test('failed tests: the release is skipped, announced once, and only --retry tries it again', () => {
		commit('v2');
		tag('v2.0.0');
		release('v2.0.0');
		testRuns([['completed', 'failure', '2026-10-10T04:00:00Z']]);
		let run = watch();
		assert.equal(run.status, 1);
		assert.deepEqual(run.updates, []);
		assert.match(state(), /^result=skipped$/m);
		assert.match(run.webhook, /wasn't deployed: the Tests workflow ended with `failure`/);

		testRuns([['completed', 'success', '2026-10-10T05:00:00Z']]);
		run = watch();
		assert.equal(run.status, 0);
		assert.match(run.output, /already handled \(skipped\)/);
		assert.deepEqual(run.updates, []);

		run = watch(['--retry']);
		assert.equal(run.status, 0, run.output);
		assert.equal(run.updates.length, 1);
		assert.match(state(), /^result=deployed$/m);
	});

	test('a failed update is recorded and announced with the log\'s last lines, and --retry runs it again', () => {
		commit('v3');
		tag('v3.0.0');
		release('v3.0.0');
		testRuns([['completed', 'success', '2026-10-10T06:00:00Z']]);
		let run = watch([], { FAIL_UPDATE: '1' });
		assert.equal(run.status, 1);
		assert.equal(run.updates.length, 1);
		assert.match(state(), /^result=failed$/m);
		assert.match(run.webhook, /❌ Deploying \*\*v3\.0\.0\*\*/);
		assert.match(run.webhook, /Retry with `sudo megura-watch --retry`/);
		assert.match(run.webhook, /FAILED: the new version did not become healthy/, 'the update\'s last lines are in the message');

		run = watch();
		assert.match(run.output, /already handled \(failed\)/);
		assert.deepEqual(run.updates, []);

		run = watch(['--retry']);
		assert.equal(run.status, 0, run.output);
		assert.equal(run.updates.length, 1);
		assert.match(state(), /^result=deployed$/m);

		// --retry never redeploys a release that went out fine
		run = watch(['--retry']);
		assert.deepEqual(run.updates, []);
	});

	test('a release whose commit isn\'t on main is refused', () => {
		git(SEED, 'checkout', '-q', '-b', 'side');
		commit('side');
		tag('v4.0.0-side');
		git(SEED, 'checkout', '-q', 'main');
		release('v4.0.0-side');
		testRuns([['completed', 'success', '2026-10-10T07:00:00Z']]);
		const run = watch();
		assert.equal(run.status, 1);
		assert.deepEqual(run.updates, []);
		assert.match(state(), /^result=refused$/m);
		assert.match(run.webhook, /isn't on `main`/);
	});

	test('a tag name that could be read as an option or path trick is ignored', () => {
		release('--upload-pack=touch x');
		const run = watch();
		assert.equal(run.status, 1);
		assert.match(run.output, /odd tag name/);
		assert.deepEqual(run.updates, []);
	});

	test('a release that changes the watcher itself says to reinstall it', () => {
		fs.appendFileSync(path.join(SEED, 'scripts', 'release-watch.sh'), '# changed\n');
		git(SEED, 'commit', '-qam', 'watcher change');
		git(SEED, 'push', '-q', 'origin', 'main');
		tag('v5.0.0');
		release('v5.0.0');
		testRuns([['completed', 'success', '2026-10-10T08:00:00Z']]);
		const run = watch();
		assert.equal(run.status, 0, run.output);
		assert.match(run.webhook, /changes the watcher itself/);
	});

	test('--status shows the last result and the latest release', () => {
		const run = watch(['--status']);
		assert.equal(run.status, 0, run.output);
		assert.match(run.output, /Last release handled: v5\.0\.0 \([0-9a-f]{7}\): deployed/);
		assert.match(run.output, /Latest release on GitHub: v5\.0\.0/);
	});

	test('a release of a commit the server already has is reported as included, not deployed', () => {
		tag('v4.1.0', 'main~1');
		release('v4.1.0');
		testRuns([['completed', 'success', '2026-10-10T09:00:00Z']]);
		const head = git(SERVER, 'rev-parse', 'HEAD');
		let run = watch();
		assert.equal(run.status, 0, run.output);
		assert.equal(run.updates.length, 1);
		assert.equal(git(SERVER, 'rev-parse', 'HEAD'), head, 'nothing moved backwards');
		assert.match(state(), /^result=included$/m);
		assert.match(run.webhook, /ℹ️ \*\*v4\.1\.0\*\* .* is already included in the deployed version/);
		assert.ok(!run.webhook.includes('✅'));

		// like a deployed release, it isn't retried
		run = watch(['--retry']);
		assert.match(run.output, /already handled \(included\)/);
		assert.deepEqual(run.updates, []);
	});
});
