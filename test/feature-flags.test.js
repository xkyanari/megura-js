// Every feature the code checks with validateFeature must exist in
// features-example.json, or it is silently off for every subscription tier.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const example = JSON.parse(fs.readFileSync(path.join(root, 'assets/features-example.json'), 'utf8'));

const sourceFiles = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
	const relative = path.join(dir, entry.name);
	if (entry.isDirectory()) return sourceFiles(relative);
	return entry.name.endsWith('.js') ? [relative] : [];
});

const checkedFlags = new Set(
	['commands', 'components', 'functions', 'events'].flatMap(sourceFiles).flatMap((file) =>
		[...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/validateFeature\([^,]+,[^,]+,\s*'(\w+)'\)/g)]
			.map((match) => match[1])),
);

test('the code checks at least one feature flag', () => {
	assert.ok(checkedFlags.size > 0);
});

for (const flag of checkedFlags) {
	test(`${flag} is defined in features-example.json`, () => {
		const tiersWithFlag = Object.keys(example).filter((tier) => flag in example[tier]);
		assert.ok(tiersWithFlag.length > 0, `${flag} is checked in the code but missing from every tier`);
	});
}

// Bitcoin auctions are switched off (see auctionsEnabled in src/vars.js);
// this used to check they were on from Premium up.
test('auctions are off on every tier', () => {
	assert.deepEqual(
		Object.fromEntries(Object.entries(example).map(([tier, flags]) => [tier, flags.hasAuction])),
		{ free: false, premium: false, enterprise: false, megura: false },
	);
});

test('bosses stay off on every tier until the storyline turns them on', () => {
	for (const [tier, flags] of Object.entries(example)) {
		assert.equal(flags.hasBosses, false, `${tier} has hasBosses on`);
	}
});
