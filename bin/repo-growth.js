#!/usr/bin/env node

const { main } = require('../src/index');

main().catch((error) => {
  console.error(`repo-growth: ${error.message}`);
  process.exitCode = 1;
});
