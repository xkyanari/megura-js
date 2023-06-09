const cloudinary = require('cloudinary').v2;
const { cloudName, cloudApiKey, cloudApiSecret } = require('../config.json');

cloudinary.config({
	cloud_name: cloudName,
	api_key: cloudApiKey,
	api_secret: cloudApiSecret,
	secure: true,
});

const uploadImage = async (imageBuffer, flag) => {
	try {
		const base64Image = `data:image/png;base64,${imageBuffer.toString(
			'base64',
		)}`;

		const response = await cloudinary.uploader.upload(base64Image, {
			public_id: flag,
		});

		return response.secure_url;
	}
	catch (error) {
		console.error('Error:', error);
	}
};

const deleteImage = async (flag) => {
	try {
		cloudinary.uploader.destroy(flag, (error, result) => {
			if (error) {
				console.error('Error deleting image:', error);
			}
			else {
				console.log('Image deleted:', result);
			}
		});
	}
	catch (error) {
		console.error(error);
	}
};

module.exports = { uploadImage, deleteImage };
