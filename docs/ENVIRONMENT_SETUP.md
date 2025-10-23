# Development Environment Setup

This document explains the contained development environment for the rec_to_nwb_yaml_creator project.

## Overview

This project uses a **contained environment** approach to ensure:
- **No global pollution** - Dependencies install locally to `node_modules/`
- **Reproducibility** - Same Node version + package versions = identical environment
- **Data safety** - Environment consistency prevents subtle bugs in scientific data pipeline

## Components

### 1. .nvmrc (Node Version Control)

- **Location:** `.nvmrc` (project root)
- **Content:** `20.19.5`
- **Purpose:** Locks Node.js version for all developers and CI/CD
- **Usage:** Run `nvm use` to automatically switch to correct version

### 2. package-lock.json (Dependency Locking)

- **Location:** `package-lock.json` (project root)
- **Purpose:** Locks exact versions of all dependencies and sub-dependencies
- **Maintenance:** Automatically updated by `npm install`, must stay committed to git
- **Why critical:** Even minor version differences can cause validation bugs in YAML generation

### 3. /setup Command (Automated Verification)

- **Location:** `.claude/commands/setup.md`
- **Purpose:** Automated environment verification for Claude Code
- **Usage:** Claude Code runs `/setup` at session start
- **Verification:** Checks Node version, installs dependencies, validates environment

## Setup Instructions

### For Claude Code (Automated)

```bash
/setup
```

The command will handle everything and report when ready.

### For Humans (Manual)

```bash
# 1. Ensure nvm is installed
# Visit: https://github.com/nvm-sh/nvm if needed

# 2. Clone repository
git clone https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator.git
cd rec_to_nwb_yaml_creator

# 3. Switch to correct Node version
nvm use  # Reads .nvmrc automatically

# 4. Install dependencies
npm install  # Reads package-lock.json for exact versions

# 5. Verify environment
node --version    # Should show: v20.19.5
npm test          # Should run without errors
npm start         # Should launch dev server
```

## Maintenance

### Updating Node.js Version

When upgrading Node.js:

```bash
# 1. Update .nvmrc
echo "21.0.0" > .nvmrc

# 2. Test with new version
nvm install 21.0.0
nvm use
npm install
npm test

# 3. Verify all tests pass
npm test -- --watchAll=false

# 4. Commit changes
git add .nvmrc package-lock.json
git commit -m "chore: upgrade Node.js to v21.0.0"

# 5. Update CLAUDE.md references to Node version
```

### Adding/Updating Dependencies

```bash
# 1. Add dependency
npm install package-name

# 2. Verify package-lock.json changed
git status

# 3. Test thoroughly
npm test -- --watchAll=false

# 4. Commit both files
git add package.json package-lock.json
git commit -m "feat: add package-name for [purpose]"
```

### Troubleshooting

**Problem:** `nvm: command not found`
```bash
# Solution: Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# Then restart terminal
```

**Problem:** Wrong Node version active
```bash
# Solution: Use nvm to switch
nvm use  # Reads .nvmrc
```

**Problem:** Module import errors
```bash
# Solution: Reinstall dependencies
rm -rf node_modules
npm install
```

**Problem:** Version conflicts between projects
```bash
# Solution: Use nvm to switch versions per project
cd project1 && nvm use  # Uses project1's .nvmrc
cd project2 && nvm use  # Uses project2's .nvmrc
```

## Integration with trodes_to_nwb

This project generates YAML files consumed by the Python package [trodes_to_nwb](https://github.com/LorenFrankLab/trodes_to_nwb). While that project uses Python's virtual environments (conda/venv), the principles are identical:

- **Isolation:** Dependencies don't pollute global scope
- **Reproducibility:** Locked versions ensure consistent behavior
- **Data safety:** Environment consistency prevents subtle data corruption bugs

## Why This Matters for Scientific Infrastructure

This application generates metadata for **irreplaceable scientific experiments**:
- Multi-month chronic recording studies (30-200+ days)
- Multi-year longitudinal data
- Published research findings
- Public archives (DANDI)

**Environment inconsistencies can:**
- Introduce subtle validation bugs
- Generate invalid YAML that corrupts NWB files
- Break database queries in Spyglass
- Invalidate months of experimental work

**Contained environments prevent this by:**
- Ensuring Claude Code always works with tested dependency versions
- Eliminating "works on my machine" scenarios
- Making bugs reproducible across all developers
- Providing clear rollback path if dependencies break

## References

- [nvm Documentation](https://github.com/nvm-sh/nvm)
- [npm package-lock.json](https://docs.npmjs.com/cli/v9/configuring-npm/package-lock-json)
- [CLAUDE.md](../CLAUDE.md) - Main Claude Code instructions
