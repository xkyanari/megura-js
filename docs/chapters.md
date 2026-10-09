# Uploading Chapters

This guide explains how writers create chapters for the `chapters/` folder, and how moderators play them in a server with `/story`. Dahlia posts each paragraph as its own message, pausing as the writer asks.

## Chapter Format

1. Write your chapter as a plain text file (\*.txt) using any text editor of your choice.
2. Separate paragraphs by a blank line (two line breaks).
3. To add a delay between paragraphs, insert a line with the desired number of seconds followed by the word "seconds" (e.g., `5 seconds`). This line should also be separated from the paragraphs by blank lines. The delay applies after every paragraph that follows it, until the next delay line.
4. To summon a world boss at a point in the story, put `[boss]` on its own line. The story waits until the fight is over, then carries on. In servers without bosses the line is skipped.
5. Save your file with a `.txt` extension (e.g., `Chapter-002-Episode-001.txt`). The file name, without `.txt`, is the chapter's name in `/story`, and chapters are listed in name order.
6. Upload your chapter file to the `chapters/` folder. A chapter there replaces a sample with the same name, and empty files are ignored.

## Example Chapter

```
This is the first paragraph of the chapter.

This is the second paragraph of the chapter.

5 seconds

This is the third paragraph of the chapter, which will be displayed after a 5-second delay.
```

## Notes for Writers

- Ensure that your paragraphs are well-formatted and easy to read.
- Keep in mind that each paragraph will be sent as a separate message in Discord, so avoid writing overly long paragraphs.
- Use delays sparingly and when it makes sense for the narrative, such as during scene transitions or dramatic moments.
- You can also refer to the samples/ folder for the formatting.

## Playing Chapters (Moderators)

Members with the **Moderate Members** permission can use `/story`:

* `/story play chapter:<name> channel:<#channel>` plays a chapter in that channel (default: the current one). Only one chapter plays in a channel at a time.
* `/story stop` stops the chapter playing in the current channel, after the paragraph it is on.
* `/story list` shows every chapter, with a ✅ and the date for the ones this server has played to the end.

Only chapters in the list can be played: Dahlia never opens other files.
