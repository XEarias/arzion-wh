module.exports = {
  testEnvironment: './jest.env.js',
  setupFilesAfterEnv: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/config/env/']
};
