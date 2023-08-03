/**
 * PLEASE REFER TO /assets/features-example.json to change the values!!
 * Set to true or false (remove quotation marks) to your liking. You can also reduce the tiers if you like but make sure to adjust it in your db
 */

const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;

const getFeaturesFromFile = async () => {
	const data = await fs.readFile('assets/features.json', 'utf8');
	const features = JSON.parse(data);
	return features;
};

const validateFeature = async (interaction, version, featureName) => {
	const features = await getFeaturesFromFile();

	if (!features[version]) {
		throw new Error(`Invalid version '${version}' passed to checkFeature.`);
	}

	const featureCheck = !!features[version][featureName];

	if (!featureCheck) {
		const embed = new EmbedBuilder().setColor('Red').setTitle('Oops!').setDescription(`
		Sorry, this feature is not available in your current version.
		Please upgrade to access this feature or join our [Support Server](https://discord.gg/X9eEW6yuhq) if this is an error. Thanks!`);
		await interaction.reply({ embeds: [embed], ephemeral: true });
		return false;
	}

	return true;
};

module.exports = {
	validateFeature,
};