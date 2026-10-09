const Redis = require('ioredis');
const { redis_url } = require('./config.json');

const redisURL = redis_url || 'redis://127.0.0.1:6379';
const redis = new Redis(redisURL);

redis.on('connect', () => {
	console.log('Redis connection successful.');
});

redis.on('error', (err) => {
	console.error('Error occurred in Redis.', err);
});

module.exports = redis;
module.exports.redisURL = redisURL;
