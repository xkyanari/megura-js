const generateId = async (length) => {
	const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let Id = '';
	for (let i = 0; i < length; i++) {
		Id += charset.charAt(Math.floor(Math.random() * charset.length));
	}
	return Id;
};

module.exports = { generateId };