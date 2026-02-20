#!/usr/bin/env node
// Release script: bump version, build, commit, tag.
// Usage: npm run release -- <version>
// Example: npm run release -- 0.5.6
//
// After this runs, publish manually:
//   npm publish --otp=<your-2fa-code>
//   git push && git push --tags

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: npm run release -- <version>  (e.g. 0.5.6)');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

// 1. Bump version in package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const prev = pkg.version;
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Bumped ${prev} → ${version}`);

// 2. Build
run('npm run build');

// 3. Commit + tag
run(`git add package.json dist/`);
run(`git commit -m "chore: bump version to ${version}"`);
run(`git tag v${version}`);

console.log(`
Done. To publish:

  npm publish --otp=<your-2fa-code>
  git push && git push --tags
`);
