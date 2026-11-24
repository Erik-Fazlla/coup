/** Two scripted players for on-device checks: BOT_CODE=ABCDE npx jest --config jest.bots.config.js */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tools/bots/**/*.test.ts'],
  testTimeout: 15 * 60 * 1000,
};
