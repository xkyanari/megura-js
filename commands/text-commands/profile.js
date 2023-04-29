const levelup = require('../../functions/levelup');

module.exports = {
    name: 'profile1',
    description: 'Test profile for level up banner',
    usage: '',
    async execute(message) {
        await levelup(message);
    },
};
