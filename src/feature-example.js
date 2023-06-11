/**
 * change the values to true or false to your liking
 * you can also reduce the tiers if you like but make sure to adjust it in your db
 */

const features = {
	free: {
		stakingRate: '',
		buyGlobal: '',
		hasRoles: '',
		transferIura: '',
		sellGlobal: '',
	},
	premium: {
		stakingRate: '',
		buyGlobal: '',
		hasRoles: '',
		ownEvents: '',
		transferIura: '',
		sellGlobal: '',
		iuraOnly: '',
	},
	enterprise: {
		stakingRate: '',
		buyGlobal: '',
		hasRoles: '',
		ownDahlia: '',
		ownServer: '',
		ownBranding: '',
		ownEvents: '',
		ownTokens: '',
		ownStory: '',
		ownTwitter: '',
		ownRaid: '',
		nftStaking: '',
		crossServer: '',
		transferIura: '',
		sellGlobal: '',
		iuraOnly: '',
	},
	megura: {
		stakingRate: '',
		buyGlobal: '',
		hasRoles: '',
		ownDahlia: '',
		ownServer: '',
		ownBranding: '',
		ownEvents: '',
		ownTokens: '',
		ownStory: '',
		ownTwitter: '',
		ownRaid: '',
		nftStaking: '',
		crossServer: '',
		transferIura: '',
		sellGlobal: '',
		iuraOnly: '',
	},
};

const validateFeature = async (interaction, version, featureName) => {

    if (!features[version]) {
        throw new Error(`Invalid version '${version}' passed to checkFeature.`);
    }

    const featureCheck = !!features[version][featureName];

    if (!featureCheck) {
        await interaction.reply({
            content: 'Sorry, this feature is not available in your current version. Please upgrade to access this feature.',
            ephemeral: true
        });
        return false;
    }

    return true;
};

module.exports = { validateFeature };