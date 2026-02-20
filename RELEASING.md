# Releasing declare-cc

## Process

Every release follows this sequence — no exceptions:

1. **Make changes** on `main`, commit normally
2. **Run the release script** to bump, build, commit, and tag in one step:
   ```bash
   npm run release -- <version>
   # e.g. npm run release -- 0.5.6
   ```
3. **Publish to npm** with your 2FA OTP:
   ```bash
   npm publish --otp=<your-2fa-code>
   ```
4. **Push commits and tags:**
   ```bash
   git push && git push --tags
   ```

## What the release script does

1. Bumps `version` in `package.json`
2. Runs `npm run build` (compiles `dist/declare-tools.cjs` and copies `dist/public/`)
3. Commits `package.json` + `dist/` as `chore: bump version to X.Y.Z`
4. Tags that commit as `vX.Y.Z`

## Versioning

Follows semver (`MAJOR.MINOR.PATCH`):

- **PATCH** — bug fixes, small workflow tweaks
- **MINOR** — new commands, new workflow phases, new features
- **MAJOR** — breaking changes to the install layout or DAG format

## Never

- Don't manually edit `package.json` version and forget to tag
- Don't publish without running `npm run build` first — `dist/` must be current
- Don't push tags separately after the fact — tag on the same commit as the version bump
