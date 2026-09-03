// Opt-in suite that talks to the real Betway Nigeria API. Kept out of the
// default `pnpm test` run on purpose: it proves the integration still works
// against production, which is exactly why it must not gate a build.
module.exports = {
  ...require('./jest.config.js'),
  testRegex: '.*\.live\.ts$',
  testTimeout: 30000,
};
