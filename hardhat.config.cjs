require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');

// Tests only. Deployed artifacts are built by scripts/compile-contracts.cjs.
module.exports = {
  solidity: { version: '0.8.30', settings: { optimizer: { enabled: true, runs: 200 } } },
  paths: { sources: './contracts', tests: './test', cache: './cache', artifacts: './hh-artifacts' },
};
