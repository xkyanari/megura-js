const fs = require('fs');
const path = require('path');

module.exports = async (chapterFile) => {
	const chaptersFolder = './chapters/';
	const samplesFolder = './samples/';

	const chaptersPath = path.join(chaptersFolder, chapterFile);
	const samplesPath = path.join(samplesFolder, chapterFile);

	let fileContent = '';

	// Check if the file exists in the chapters folder
	try {
		if (fs.existsSync(chaptersPath)) {
			fileContent = fs.readFileSync(chaptersPath, 'utf-8');
		}
		else if (fs.existsSync(samplesPath)) {
			fileContent = fs.readFileSync(samplesPath, 'utf-8');
		}
		else {
			console.log(
				`File '${chapterFile}' not found in ${chaptersFolder} or ${samplesFolder}.`,
			);
		}
	}
	catch (error) {
		console.log(`Error: ${error.message}`);
	}

	return fileContent;
};
