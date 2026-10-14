const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collectCommands } = require('../deploy');
const root = path.resolve(__dirname, '..');

test('Free edition excludes paid command implementations and private planning or story data', () => {
	const commands = collectCommands();
	const names = new Set(commands.map((command) => command.name));
	for (const name of ['attack', 'duel', 'brawl', 'craft', 'explore', 'setup', 'roles', 'ticket', 'form']) assert.ok(names.has(name), name);
	for (const name of ['auction', 'arena', 'boss', 'giveaway', 'raffle', 'schedule', 'specialshop', 'sales', 'open', 'close', 'transfer', 'sendGift', 'factions', 'story', 'storytelling', 'analytics']) {
		assert.equal(names.has(name), false, name);
		assert.equal(fs.existsSync(path.join(root, 'commands/slash-commands', `${name}.js`)), false, name);
	}
	for (const name of ['docs/roadmap', 'docs/storyboard', 'assets/story', 'models/guildDirectory.js', 'functions/personalStory.js', 'functions/storyAnalytics.js', 'functions/storyShare.js', 'functions/storyUI.js', 'functions/xpAnalytics.js', 'functions/giveaway.js', 'functions/raffle.js', 'functions/boss.js', 'functions/schedule.js', 'functions/specialshop.js', 'functions/order.js', 'functions/portal.js']) assert.equal(fs.existsSync(path.join(root, name)), false, name);
	assert.deepEqual(Object.keys(require('../assets/features-example.json')), ['free']);
	const setup = commands.find((command) => command.name === 'setup');
	for (const name of ['factions', 'chat', 'shop']) assert.equal(setup.options.some((option) => option.name === name), false, name);
});

test('GitBook keeps a public docs root and every navigation target exists', () => {
	assert.match(fs.readFileSync(path.join(root, '.gitbook.yaml'), 'utf8'), /root: \.\/docs\//);
	const summary = fs.readFileSync(path.join(root, 'docs/SUMMARY.md'), 'utf8');
	for (const [, target] of summary.matchAll(/\]\(([^)]+)\)/g)) {
		assert.ok(!target.startsWith('roadmap/') && !target.startsWith('storyboard/'));
		assert.ok(fs.existsSync(path.join(root, 'docs', target)), target);
	}
});
