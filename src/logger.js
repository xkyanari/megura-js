const winston = require('winston');
require('winston-daily-rotate-file');

// time is in UTC

const consoleTransport = new winston.transports.Console();

const errorTransport = new winston.transports.DailyRotateFile({
	filename: 'logs/error-%DATE%.log',
	datePattern: 'YYYY-MM-DD',
	zippedArchive: true,
	maxSize: '20m',
	maxFiles: '14d',
	level: 'error',
});

const combinedTransport = new winston.transports.DailyRotateFile({
	filename: 'logs/combined-%DATE%.log',
	datePattern: 'YYYY-MM-DD',
	zippedArchive: true,
	maxSize: '20m',
	maxFiles: '14d',
});

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	defaultMeta: { service: 'user-service' },
	transports: [errorTransport, combinedTransport, consoleTransport],
});

module.exports = logger;
