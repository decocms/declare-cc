#!/usr/bin/env node
/**
 * Bundle src/ into dist/declare-tools.cjs
 * Single-file CJS bundle for zero-install distribution.
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
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
  // Claude Agent SDK must be external — it's ESM with native bindings that can't be bundled into CJS
  external: ['@anthropic-ai/claude-agent-sdk'],
});

// Copy dashboard static files into dist/public/ so they ship in the npm package
// (src/ is not included in the package files array)
const publicSrc  = path.join(__dirname, 'src', 'server', 'public');
const publicDist = path.join(__dirname, 'dist', 'public');
fs.mkdirSync(publicDist, { recursive: true });
for (const file of fs.readdirSync(publicSrc)) {
  fs.copyFileSync(path.join(publicSrc, file), path.join(publicDist, file));
}

console.log('Built dist/declare-tools.cjs');
