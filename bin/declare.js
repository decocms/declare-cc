#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const bundlePath = path.resolve(__dirname, '../dist/declare-tools.cjs');

if (!fs.existsSync(bundlePath)) {
  console.error('[declare] Bundle not found: ' + bundlePath);
  console.error('[declare] Run `npm run build` in the declare-cc package directory.');
  process.exit(1);
}

// Forward argv as-is — declare-tools.cjs reads process.argv
require(bundlePath);
