---
description: Set up the contained development environment (Node.js + dependencies)
---

# Environment Setup

**CRITICAL:** You MUST run this at the start of any session before making code changes.

## Steps

Follow these steps in order:

### 1. Check for .nvmrc file

Run: `test -f .nvmrc && cat .nvmrc || echo "ERROR: .nvmrc not found"`

Expected: Should display Node version (e.g., "20.19.5")

### 2. Switch to correct Node version

Run: `nvm use`

Expected output should include: "Now using node v20.19.5" or similar

### 3. Verify Node version matches

Run: `node --version`

Expected: Should show "v20.19.5" (matching .nvmrc)

### 4. Install/verify dependencies

Run: `npm install`

Expected: Should complete successfully, may show "up to date" if already installed

### 5. Verify node_modules exists

Run: `ls node_modules | wc -l`

Expected: Should show a large number (800+)

### 6. Run quick smoke test

Run: `npm test -- --version`

Expected: Should display react-scripts test runner version without errors

## Success Report

After completing all steps, announce:

```
✓ Environment ready: Node v20.19.5, dependencies installed
✓ Ready to proceed with development tasks
```

## If Any Step Fails

**DO NOT PROCEED** with code changes. Report the specific failure:

```
✗ Environment setup failed at step [N]: [error message]
Unable to proceed until environment is properly configured.

Suggested fixes:
- Ensure nvm is installed: https://github.com/nvm-sh/nvm
- Check Node.js version availability: nvm ls
- Clear node_modules and retry: rm -rf node_modules && npm install
```

Ask the user to resolve the issue before continuing.
