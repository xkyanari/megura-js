/**
 * Preloaded by `npm run test:integration` (node --require).
 * The app reads ./config.json directly, so this points every require of the
 * repo-root config.json at test/config.js instead. The real config is never loaded.
 */

const Module = require('node:module');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REAL_CONFIG = path.join(ROOT, 'config.json');
const TEST_CONFIG = path.join(__dirname, 'config.js');

const config = require(TEST_CONFIG);

// Tests drop every table, so refuse to run against anything that isn't clearly a test database.
if (!/test/i.test(config.mysql_dbname)) {
	throw new Error(`Refusing to run tests against database "${config.mysql_dbname}": its name must contain "test".`);
}

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
	if (parent?.filename && request.endsWith('config.json')
		&& path.resolve(path.dirname(parent.filename), request) === REAL_CONFIG) {
		return TEST_CONFIG;
	}
	return resolveFilename.call(this, request, parent, ...rest);
};
