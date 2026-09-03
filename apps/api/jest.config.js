module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  // Live tests hit Betway for real and are opt-in (`pnpm test:live`); the
  // default run must stay hermetic so CI is not at the mercy of a
  // third-party sportsbook's uptime or of fixtures whose events have kicked off.
  testRegex: '.*\.spec\.ts$',
  transform: { '^.+\.(t|j)s$': 'ts-jest' },
  // Resolve the workspace package to its TypeScript source so unit tests
  // exercise current source without requiring packages/shared to be built.
  moduleNameMapper: {
    '^@slipstream/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
