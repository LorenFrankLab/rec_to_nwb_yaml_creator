# Git Hooks Documentation

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks that run automatically during the commit and push workflow.

## Pre-commit Hook

**Location:** `.husky/pre-commit`

**When it runs:** Before every `git commit`

**What it does:**

- Runs [lint-staged](https://github.com/okonet/lint-staged) to automatically lint and fix staged files
- Only processes files that are staged for commit (not the entire codebase)
- Configuration is in `.lintstagedrc.json`

**Current configuration:**

- JavaScript/JSX files (`*.{js,jsx}`): Runs ESLint with auto-fix

**Execution time:** Usually < 5 seconds (only checks staged files)

## Pre-push Hook

**Location:** `.husky/pre-push`

**When it runs:** Before every `git push`

**What it does:**

- Runs baseline tests to ensure no regressions are pushed to the remote repository
- Blocks the push if baseline tests fail
- Provides clear error messages if tests fail

**Execution time:** Usually < 30 seconds (depends on number of baseline tests)

## Bypassing Hooks

There are legitimate situations where you may need to bypass hooks:

### Bypassing pre-commit hook

```bash
git commit --no-verify -m "Your commit message"
# or short form
git commit -n -m "Your commit message"
```

**When to use:**

- Emergency hotfixes that need to bypass linting temporarily
- WIP commits on feature branches (though consider fixing lint errors instead)
- CI/CD automated commits

### Bypassing pre-push hook

```bash
git push --no-verify
# or short form
git push -n
```

**When to use:**

- Emergency pushes when baseline tests are temporarily broken
- Pushing documentation-only changes
- Pushing to feature branches when you know tests are failing but want to share code

## Warning: Use --no-verify Responsibly

While bypassing hooks is sometimes necessary, it should be used sparingly:

- ❌ **Don't** use `--no-verify` to avoid fixing legitimate issues
- ❌ **Don't** bypass hooks on commits to `main` or release branches
- ✅ **Do** fix the underlying issue and commit properly when possible
- ✅ **Do** communicate with team when bypassing hooks
- ✅ **Do** ensure CI still passes even if hooks are bypassed

## Hook Configuration Files

### `.lintstagedrc.json`

Controls what linting/formatting happens on staged files:

```json
{
  "*.{js,jsx}": [
    "eslint --fix"
  ]
}
```

To modify what happens on commit:

1. Edit `.lintstagedrc.json`
2. Add/remove file patterns or commands
3. Test with `npx lint-staged` before committing

### `.husky/pre-commit` and `.husky/pre-push`

Simple shell scripts that run before commit/push.

**Modern Husky format (v9+):**

- No shebang or source lines needed
- Just write commands directly in the file

## Troubleshooting

### Hooks not running

```bash
# Reinstall Husky hooks
npm run prepare
```

### Lint-staged not finding files

This is normal if no staged files match the patterns in `.lintstagedrc.json`. The commit will proceed normally.

### Pre-push tests failing

```bash
# Run baseline tests locally to see failures
npm run test:baseline -- --run

# Fix failing tests or investigate regression
# Then commit the fix and push again
```

### Hooks running but with errors

Check the hook output carefully:

- ESLint errors: Fix code style issues
- Test failures: Investigate regression or update baselines
- Permission errors: Ensure hooks are executable (`chmod +x .husky/*`)

## CI/CD Integration

Note that hooks are a **local safety net** - they complement CI/CD but don't replace it:

- Hooks run on developer machines before code reaches the repository
- CI/CD runs on every push/PR regardless of hooks
- CI/CD is the authoritative check - hooks can be bypassed, CI cannot
- Hooks provide fast feedback, CI provides comprehensive validation

## For New Contributors

When you clone this repository and run `npm install`, Husky hooks are automatically installed via the `prepare` script in `package.json`.

No additional setup is needed - hooks will start working immediately on your next commit.
