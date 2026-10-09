const fs = require('node:fs');
const path = require('node:path');
const { StoryProgress } = require('../src/db');

/**
 * The storyline player (/story). Chapters are plain-text files in chapters/
 * (preferred) or samples/, written as described in docs/chapters.md:
 * paragraphs separated by blank lines, posted one message each;
 * a line "N seconds" sets the pause after each paragraph that follows it;
 * a line "[boss]" summons a world boss there (servers with bosses only).
 *
 * Only files listed by listChapters() can be played: a name is never joined
 * into a path, so "../config.json" can't reach anything outside these folders.
 */

const ROOT = path.join(__dirname, '..');
const CHAPTER_DIRS = ['chapters', 'samples'];
// Discord messages hold 2000 characters
const MAX_MESSAGE = 2000;
const PAUSE = /^(\d+)\s*seconds?$/i;
const BOSS = /^\[boss\]$/i;

// Every playable chapter: [{ name, file }], sorted by name. chapters/ wins over samples/; empty files are skipped.
const listChapters = ({ dirs = CHAPTER_DIRS, root = ROOT } = {}) => {
	const found = new Map();
	for (const dir of dirs) {
		const full = path.join(root, dir);
		if (!fs.existsSync(full)) continue;
		for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
			if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.txt')) continue;
			const name = entry.name.slice(0, -4);
			const file = path.join(full, entry.name);
			if (found.has(name) || fs.statSync(file).size === 0) continue;
			found.set(name, { name, file });
		}
	}
	return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
};

// The listed chapter with this name (with or without .txt), or null.
const chapterNamed = (name, options) => {
	const wanted = String(name ?? '').replace(/\.txt$/i, '');
	return listChapters(options).find((chapter) => chapter.name === wanted) ?? null;
};

// Splits text into pieces Discord accepts, at line breaks where possible.
const splitMessage = (text) => {
	const pieces = [];
	let rest = text;
	while (rest.length > MAX_MESSAGE) {
		const cut = rest.lastIndexOf('\n', MAX_MESSAGE);
		const at = cut > 0 ? cut : MAX_MESSAGE;
		pieces.push(rest.slice(0, at));
		rest = rest.slice(at).replace(/^\n/, '');
	}
	if (rest) pieces.push(rest);
	return pieces;
};

// The chapter as steps: { pause: ms } | { boss: true } | { text }.
const parseChapter = (content) => content
	.replace(/\r\n/g, '\n')
	.split(/\n\s*\n/)
	.map((block) => block.trim())
	.filter(Boolean)
	.map((block) => {
		const pause = block.match(PAUSE);
		if (pause) return { pause: Number(pause[1]) * 1000 };
		if (BOSS.test(block)) return { boss: true };
		return { text: block };
	});

// Playbacks running in this process, by channel ID: { stopped }.
const playing = new Map();

const isPlaying = (channelID) => playing.has(channelID);

// Stops the playback in the channel. Returns false if nothing was playing.
const stopChapter = (channelID) => {
	const playback = playing.get(channelID);
	if (!playback) return false;
	playback.stopped = true;
	return true;
};

/**
 * Plays a listed chapter in the channel, one paragraph at a time. onBoss() is
 * awaited at a [boss] line (the caller decides whether bosses are allowed).
 * Resolves to 'finished', 'stopped' or 'busy' (already playing there).
 */
const playChapter = async (channel, chapter, { sleep = require('node:timers/promises').setTimeout, onBoss = async () => undefined } = {}) => {
	if (playing.has(channel.id)) return 'busy';
	const playback = { stopped: false };
	playing.set(channel.id, playback);
	try {
		const steps = parseChapter(fs.readFileSync(chapter.file, 'utf8'));
		let pause = 0;
		for (const step of steps) {
			if (playback.stopped) return 'stopped';
			if (step.pause !== undefined) {
				pause = step.pause;
				continue;
			}
			if (step.boss) {
				await onBoss();
				continue;
			}
			for (const piece of splitMessage(step.text)) await channel.send(piece);
			await sleep(pause);
		}
		return playback.stopped ? 'stopped' : 'finished';
	}
	finally {
		playing.delete(channel.id);
	}
};

const recordPlayed = (guildID, chapter, playedBy) =>
	StoryProgress.create({ guildID, chapter: chapter.name, playedBy, playedAt: new Date() });

// When each chapter was last played in the server: Map(name => Date).
const playedIn = async (guildID) => {
	const rows = await StoryProgress.findAll({ where: { guildID }, order: [['playedAt', 'ASC']] });
	return new Map(rows.map((row) => [row.chapter, row.playedAt]));
};

module.exports = {
	CHAPTER_DIRS,
	listChapters,
	chapterNamed,
	parseChapter,
	splitMessage,
	isPlaying,
	stopChapter,
	playChapter,
	recordPlayed,
	playedIn,
};
