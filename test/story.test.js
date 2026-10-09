const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const S = require('../functions/story');
const storyCommand = require('../commands/slash-commands/story');
const { resetDb, closeAll, recorder } = require('./helpers');

// A throwaway root with chapters/ and samples/ folders.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
const write = (dir, name, text) => {
	fs.mkdirSync(path.join(root, dir), { recursive: true });
	fs.writeFileSync(path.join(root, dir, name), text);
};
const options = { root };

before(async () => {
	await resetDb();
	write('samples', 'Chapter-001.txt', 'The sample version.');
	write('chapters', 'Chapter-001.txt', '2 seconds\n\nFirst.\n\nSecond.\n\n5 seconds\n\nThird.');
	write('chapters', 'Chapter-002.txt', 'Before the boss.\n\n[boss]\n\nAfter the boss.');
	write('chapters', 'Empty.txt', '');
	write('chapters', 'notes.md', 'not a chapter');
	fs.writeFileSync(path.join(root, 'secret.txt'), 'outside the chapter folders');
});
after(async () => {
	fs.rmSync(root, { recursive: true, force: true });
	await closeAll();
});

const fakeChannel = (id = 'C1') => {
	const sent = [];
	return { id, sent, send: async (text) => sent.push(text) };
};

describe('chapters', () => {
	test('only non-empty .txt files are listed, and chapters/ wins over samples/', () => {
		const chapters = S.listChapters(options);
		assert.deepEqual(chapters.map((c) => c.name), ['Chapter-001', 'Chapter-002']);
		assert.match(chapters[0].file, /chapters/);
		assert.equal(S.chapterNamed('Chapter-002.txt', options).name, 'Chapter-002');
	});

	test('names outside the list are refused, so paths can\'t escape the chapter folders', () => {
		for (const name of ['../secret', '../secret.txt', '../../config.json', '/etc/passwd', 'chapters/Chapter-001', 'Empty']) {
			assert.equal(S.chapterNamed(name, options), null, name);
		}
	});

	test('paragraphs, pauses and [boss] lines are read the way writers expect', () => {
		assert.deepEqual(S.parseChapter('3 seconds\r\n\r\nHello\nthere.\n\n\n[Boss]\n\n1 second'), [
			{ pause: 3000 },
			{ text: 'Hello\nthere.' },
			{ boss: true },
			{ pause: 1000 },
		]);
		const long = `${'a'.repeat(1500)}\n${'b'.repeat(1500)}`;
		assert.deepEqual(S.splitMessage(long).map((piece) => piece.length), [1500, 1500]);
	});
});

describe('playing', () => {
	test('posts each paragraph, pausing as written', async () => {
		const channel = fakeChannel();
		const pauses = [];
		const result = await S.playChapter(channel, S.chapterNamed('Chapter-001', options), { sleep: async (ms) => pauses.push(ms) });
		assert.equal(result, 'finished');
		assert.deepEqual(channel.sent, ['First.', 'Second.', 'Third.']);
		assert.deepEqual(pauses, [2000, 2000, 5000]);
		assert.equal(S.isPlaying('C1'), false);
	});

	test('one chapter per channel, and stop ends it after the current paragraph', async () => {
		const channel = fakeChannel('C2');
		let release;
		const playback = S.playChapter(channel, S.chapterNamed('Chapter-001', options), {
			sleep: () => new Promise((resolve) => { release = resolve; }),
		});
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(await S.playChapter(channel, S.chapterNamed('Chapter-002', options)), 'busy');
		assert.equal(S.stopChapter('C2'), true);
		release();
		assert.equal(await playback, 'stopped');
		assert.deepEqual(channel.sent, ['First.']);
		assert.equal(S.stopChapter('C2'), false, 'nothing left to stop');
	});

	test('a [boss] line waits for the boss before going on', async () => {
		const channel = fakeChannel('C3');
		const order = [];
		await S.playChapter(channel, S.chapterNamed('Chapter-002', options), {
			sleep: async () => undefined,
			onBoss: async () => order.push(`boss after ${channel.sent.length}`),
		});
		assert.deepEqual(order, ['boss after 1']);
		assert.deepEqual(channel.sent, ['Before the boss.', 'After the boss.']);
	});

	test('a finished chapter is remembered for the server', async () => {
		await S.recordPlayed('GS', S.chapterNamed('Chapter-001', options), 'MOD');
		const played = await S.playedIn('GS');
		assert.ok(played.get('Chapter-001') instanceof Date);
		assert.equal((await S.playedIn('OTHER')).size, 0);
	});
});

describe('/story', () => {
	const run = async (subcommand, { chapter } = {}) => {
		const rec = recorder();
		await storyCommand.execute({
			guild: { id: 'GS' },
			user: { id: 'MOD' },
			channelId: 'C9',
			channel: fakeChannel('C9'),
			options: {
				getSubcommand: () => subcommand,
				getString: () => chapter,
				getChannel: () => null,
			},
			reply: async (payload) => rec.push('reply', payload),
		});
		return rec.calls.at(-1)[1];
	};

	test('refuses a chapter that isn\'t listed, including paths', async () => {
		for (const chapter of ['../config.json', '../../config', 'Nope']) {
			assert.match((await run('play', { chapter })).content, /no such chapter/);
		}
	});

	test('stop with nothing playing says so', async () => {
		assert.match((await run('stop')).content, /No chapter is playing/);
	});

	test('is for moderators only', () => {
		assert.equal(storyCommand.data.toJSON().default_member_permissions, String(1n << 40n));
	});
});
