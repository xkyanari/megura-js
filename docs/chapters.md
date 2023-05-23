# Uploading Chapters

This guide explains how writers can create their chapters to be uploaded in the `chapters/` folder. The system reads each paragraph with a delay and prints them out on Discord as individual messages. The following code files are used for this functionality:

- `readfile.js`: Reads the content of a chapter file from either the `chapters/` or `samples/` folder.
- `displaytext.js`: Displays the chapter text in Discord messages with a specified delay between paragraphs.

## Chapter Format

1. Write your chapter as a plain text file (\*.txt) using any text editor of your choice.
2. Separate paragraphs by a blank line (two line breaks).
3. To add a delay between paragraphs, insert a line with the desired number of seconds followed by the word "seconds" (e.g., `5 seconds`). This line should also be separated from the paragraphs by blank lines.
4. Save your file with a `.txt` extension (e.g., `chapter1.txt`).
5. Upload your chapter file to the `chapters/` folder.

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
