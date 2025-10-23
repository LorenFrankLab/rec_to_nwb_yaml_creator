# Contained Environment Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Create a reproducible, contained Node.js development environment using .nvmrc + package-lock.json with clear setup instructions for Claude Code.

**Architecture:** Use existing nvm for Node.js version management, lock version via .nvmrc file, ensure package-lock.json is committed, create /setup slash command for automated environment verification, and update CLAUDE.md with mandatory setup workflow.

**Tech Stack:** Node.js v20.19.5, npm, nvm, bash scripting

---

## Task 1: Create .nvmrc File

**Files:**
- Create: `.nvmrc`
- Test: Manual verification with `nvm use`

**Step 1: Create .nvmrc with current Node version**

Create file at project root:

```
20.19.5
```

**Step 2: Verify nvm recognizes the file**

Run: `nvm use`
Expected output: "Found '.nvmrc' file with version <20.19.5>" or "Now using node v20.19.5"

**Step 3: Test switching to different version and back**

Run:
```bash
nvm use system  # or any other installed version
nvm use         # should switch back to 20.19.5
node --version  # should show v20.19.5
```

Expected: Successfully switches to v20.19.5

**Step 4: Commit**

```bash
git add .nvmrc
git commit -m "chore: add .nvmrc to lock Node.js version to 20.19.5

Ensures reproducible development environment across all contributors and Claude Code sessions.
Prevents version mismatch issues."
```

---

## Task 2: Create /setup Slash Command

**Files:**
- Create: `.claude/commands/setup.md`

**Step 1: Create the setup command file**

Create file at `.claude/commands/setup.md`:

```markdown
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
```

**Step 2: Verify the command can be read**

Run: `cat .claude/commands/setup.md | head -20`

Expected: Should display the markdown content

**Step 3: Test the command is recognized (if possible)**

The command should now be available as `/setup` in Claude Code sessions.

**Step 4: Commit**

```bash
git add .claude/commands/setup.md
git commit -m "feat: add /setup slash command for environment verification

Creates mandatory environment setup workflow for Claude Code:
- Verifies Node version matches .nvmrc
- Ensures dependencies are installed
- Validates environment before allowing code changes

Part of contained environment setup to prevent global pollution and ensure reproducibility."
```

---

## Task 3: Update CLAUDE.md - Add Environment Setup Section

**Files:**
- Modify: `CLAUDE.md` (add new section after line 5, before "## ⚠️ CRITICAL")

**Step 1: Read current CLAUDE.md structure**

Run: `head -20 CLAUDE.md`

Expected: Shows current file header and critical section

**Step 2: Add Environment Setup section**

Add this new section at line 6 (right after the "This file provides guidance..." line and before the "---" separator):

```markdown

## 🔧 Environment Setup - Run FIRST

**Before starting ANY work in this codebase, you MUST set up the contained environment.**

### Quick Start

Run the setup command:
```
/setup
```

This command will:
1. Verify Node.js version matches `.nvmrc` (v20.19.5)
2. Switch to correct version using nvm
3. Install exact dependency versions from `package-lock.json`
4. Verify environment is ready

### Why This Matters

**Global Pollution Prevention:** All dependencies install to project-local `node_modules/`, not global npm cache.

**Reproducibility:** Same Node version + same package versions = identical environment across all machines and sessions.

**Critical for Scientific Infrastructure:** Environment inconsistencies can introduce subtle bugs in YAML generation that corrupt scientific data.

### Manual Setup (if /setup fails)

```bash
# 1. Check .nvmrc exists
cat .nvmrc

# 2. Switch Node version
nvm use

# 3. Install dependencies
npm install

# 4. Verify
node --version  # Should match .nvmrc
npm test -- --version  # Should run without errors
```

### When Environment is Ready

You'll see:
```
✓ Environment ready: Node v20.19.5, dependencies installed
✓ Ready to proceed with development tasks
```

Only after seeing this message should you proceed with code changes.

```

**Step 3: Verify the section was added correctly**

Run: `head -80 CLAUDE.md | tail -60`

Expected: Should show the new Environment Setup section

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Environment Setup section to CLAUDE.md

Makes environment setup the FIRST thing Claude Code must do before any work.
Explains why it matters for scientific infrastructure and data integrity.
Provides both automated (/setup) and manual setup instructions."
```

---

## Task 4: Update CLAUDE.md - Modify "When Making Any Change" Workflow

**Files:**
- Modify: `CLAUDE.md:36-63` (the "When Making Any Change" section)

**Step 1: Locate the workflow section**

Run: `grep -n "### When Making Any Change" CLAUDE.md`

Expected: Shows line number (should be around line 36, but may have shifted after Task 3)

**Step 2: Update the workflow checklist**

Find this section:
```bash
### When Making Any Change

```bash
# 1. Read existing code first
Read the file you're about to modify
```

Update it to:
```bash
### When Making Any Change

```bash
# 0. FIRST: Verify environment is set up
/setup  # Run this command to verify Node version and dependencies

# 1. Read existing code first
Read the file you're about to modify
```

**Step 3: Verify the change**

Run: `grep -A 15 "### When Making Any Change" CLAUDE.md`

Expected: Should show the updated workflow with step 0 added

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add environment verification as step 0 in workflow

Updates 'When Making Any Change' checklist to make /setup the mandatory first step.
Ensures Claude Code always works in a properly configured environment."
```

---

## Task 5: Update CLAUDE.md - Add to Common Commands Section

**Files:**
- Modify: `CLAUDE.md` (around line 223-232, the "Common Commands" section)

**Step 1: Locate the Common Commands section**

Run: `grep -n "## Common Commands" CLAUDE.md`

Expected: Shows line number (around line 223, may have shifted)

**Step 2: Add environment commands subsection**

After the opening "## Common Commands" line and before "### Development", add:

```markdown

### Environment Setup

```bash
/setup                 # Automated environment verification (recommended)
nvm use                # Switch to Node version from .nvmrc
node --version         # Check current Node version (should match .nvmrc: v20.19.5)
npm install            # Install exact dependency versions from package-lock.json
```

**When to run:**
- Start of every Claude Code session
- After pulling changes that update .nvmrc or package.json
- When switching between projects
- If you see module import errors or version mismatches

```

**Step 3: Verify the addition**

Run: `grep -A 15 "## Common Commands" CLAUDE.md`

Expected: Should show the new Environment Setup subsection

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add environment commands to Common Commands section

Documents when and how to run environment setup.
Makes /setup discoverable in the common commands reference."
```

---

## Task 6: Verify package-lock.json is Properly Committed

**Files:**
- Verify: `package-lock.json`

**Step 1: Check if package-lock.json is in git**

Run: `git ls-files --error-unmatch package-lock.json`

Expected: Should show "package-lock.json" (confirms it's tracked)

**Step 2: Check for .gitignore entries that might exclude it**

Run: `grep -n "package-lock" .gitignore`

Expected: Should show no results or "No such file or directory" (confirms it's not ignored)

**Step 3: Verify package-lock.json is up to date**

Run: `npm install --package-lock-only`

Expected: Should complete quickly with "up to date" message

**Step 4: Check if there are uncommitted changes**

Run: `git status package-lock.json`

Expected: Should show "nothing to commit" or no output (confirms it's current)

**Step 5: Document findings**

If package-lock.json is properly committed: ✓ No action needed, proceed to next task.

If package-lock.json has changes:
```bash
git add package-lock.json
git commit -m "chore: update package-lock.json to current state

Ensures dependency lock file reflects current package.json state.
Critical for reproducible builds."
```

---

## Task 7: Create Documentation Summary

**Files:**
- Create: `docs/ENVIRONMENT_SETUP.md`

**Step 1: Create comprehensive environment documentation**

Create file at `docs/ENVIRONMENT_SETUP.md`:

```markdown
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
```

**Step 2: Verify the documentation was created**

Run: `cat docs/ENVIRONMENT_SETUP.md | head -30`

Expected: Should show the documentation header and overview

**Step 3: Commit**

```bash
git add docs/ENVIRONMENT_SETUP.md
git commit -m "docs: add comprehensive environment setup documentation

Creates detailed reference for:
- How the contained environment works
- Setup instructions (automated and manual)
- Maintenance procedures
- Troubleshooting guide
- Integration with trodes_to_nwb
- Why it matters for scientific infrastructure"
```

---

## Task 8: Run Full Verification

**Files:**
- Verify: All created/modified files

**Step 1: Test the /setup command end-to-end**

If in Claude Code, run: `/setup`

If manual testing:
```bash
# Switch away and back to test
nvm use system
nvm use
node --version  # Should show v20.19.5
npm install
npm test -- --version
```

Expected: All commands succeed, environment is verified

**Step 2: Verify all files are committed**

Run: `git status`

Expected: Should show "nothing to commit, working tree clean" or only show untracked files from REVIEW.md etc.

**Step 3: Review commit history**

Run: `git log --oneline -8`

Expected: Should show 6-7 new commits for this feature

**Step 4: Test that development commands work**

Run in sequence:
```bash
npm test -- --version  # Should show react-scripts test version
npm run lint -- --version  # Should show eslint version
```

Expected: All commands succeed without errors

**Step 5: Generate summary**

Create a summary of what was implemented:

```
✓ Contained Environment Setup Complete

Files created:
- .nvmrc (Node v20.19.5)
- .claude/commands/setup.md (automated verification)
- docs/ENVIRONMENT_SETUP.md (comprehensive guide)

Files modified:
- CLAUDE.md (environment setup section + workflow updates)

Commits: 6-7 commits
Tests: All verification steps passed

Next steps:
- Push to remote: git push origin modern
- Test in fresh clone to verify reproducibility
- Update team on new /setup workflow
```

---

## Testing Strategy

After implementation:

1. **Local verification:** Run through Task 8 checklist
2. **Fresh clone test:** Clone repo in new location, run `nvm use && npm install && npm test`
3. **Claude Code test:** Start new Claude session, run `/setup`, verify it works
4. **Documentation review:** Ask someone unfamiliar with the changes to follow `docs/ENVIRONMENT_SETUP.md`

## Success Criteria

- [ ] `.nvmrc` exists with correct version
- [ ] `/setup` command runs successfully
- [ ] CLAUDE.md mandates environment setup as step 0
- [ ] Documentation is comprehensive and clear
- [ ] All commits follow conventional commit format
- [ ] Fresh clone can set up environment without errors
- [ ] Claude Code can run `/setup` and proceed with development

---

## Notes

- This does NOT require changes to .gitignore (node_modules already ignored by default)
- This does NOT require changes to package.json
- This does NOT require changes to CI/CD (can be added later)
- This is a **documentation and configuration** task, not code changes
- Should take ~30-45 minutes to implement completely
