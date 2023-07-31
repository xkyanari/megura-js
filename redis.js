const Redis = require('ioredis');
const redis = new Redis();

redis.on('connect', () => {
  console.log('Redis connection successful.');
});

redis.on('error', (err) => {
  console.error('Error occurred in Redis.', err);
});

module.exports = redis;
