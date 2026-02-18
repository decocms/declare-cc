#!/usr/bin/env node
/**
 * Bundle src/ into dist/declare-tools.cjs
 * Single-file CJS bundle for zero-install distribution.
 */

const esbuild = require('esbuild');
const path = require('path');
const { version } = require('./package.json');

esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src', 'declare-tools.js')],
  outfile: path.join(__dirname, 'dist', 'declare-tools.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  minify: false,
  // Inject package version so DECLARE_VERSION is available in source
  define: { DECLARE_VERSION: JSON.stringify(version) },
  // Zero runtime dependencies -- bundle everything
  external: [],
});

console.log('Built dist/declare-tools.cjs');
