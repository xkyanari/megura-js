/**
 * Config used in place of config.json while tests run (see setup.js).
 * Point it at a throwaway MySQL database: every test file drops and recreates all tables.
 */

const env = process.env;

module.exports = {
	port: '0',
	website: 'http://localhost',
	website_test: 'http://localhost',
	mysql_dbname: env.TEST_MYSQL_DB || 'megura_test',
	mysql_dbuser: env.TEST_MYSQL_USER || 'megura',
	mysql_dbpass: env.TEST_MYSQL_PASS ?? 'megura',
	mysql_host: env.TEST_MYSQL_HOST || '127.0.0.1',
	mysql_port: Number(env.TEST_MYSQL_PORT || 3306),
	redis_url: env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/15',
	token: '',
	clientId: '',
	guildId: '',
	openAIkey: 'test',
	openAIorg: '',
	ENCRYPTION_KEY: '00'.repeat(32),
	cloudName: 'test',
	cloudApiKey: 'test',
	cloudApiSecret: 'test',
	dblApiKey: '',
	dblWebhookSecret: 'test',
	topWebhookSecret: 'test',
	// test files that need test-mode behaviour flip this before loading src/vars
	testMode: false,
	// auctions are switched off in production, but their code is still tested
	enableAuctions: true,
};
