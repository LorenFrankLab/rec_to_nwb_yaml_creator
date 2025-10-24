I'm working on the rec_to_nwb_yaml_creator project.

Start now by reading the files and telling me which task you'll work on first.

Your workflow MUST be:

    First, read these files IN ORDER:
        CLAUDE.md (implementation guide)
        docs/PHASE_1.5_SUMMARY.md (quick context for current phase)
        docs/SCRATCHPAD.md (notes and current status)
        docs/REFACTOR_CHANGELOG.md (changes made so far)
        docs/TASKS.md (current tasks)

    THEN if you need more detail:
        docs/plans/PHASE_1.5_TEST_QUALITY_IMPROVEMENTS.md (detailed Phase 1.5 plan)
        docs/plans/COMPREHENSIVE_REFACTORING_PLAN.md (overall project plan)

    Find the FIRST unchecked [ ] task in TASKS.md

    For EVERY feature, follow TDD:
      a. Create the TEST file first
      b. Run the test and verify it FAILS
      c. Only then create the implementation
      d. Run test until it PASSES
      e. Apply review agents (code-reviewer, other relevant agents)
      f. Refactor for clarity and efficiency based on feedback
      g. Add/Update docstrings and types.

    Update TASKS.md checkboxes as you complete items.

    Update SCRATCHPAD.md with notes and CHANGELOG.md with changes.

    Commit frequently with messages like "feat(F24): implement error handling"

Do not change tests or skip tests to match broken code. Ask permission to change requirements if needed.

### Supporting Documentation

- **docs/ENVIRONMENT_SETUP.md** - Node.js environment details
- **docs/CI_CD_PIPELINE.md** - GitHub Actions workflow documentation
- **docs/GIT_HOOKS.md** - Pre-commit/pre-push hook details
- **docs/INTEGRATION_CONTRACT.md** - Schema sync and device type contracts

## Remember

- **Read before you code** - Use Read tool to understand context
- **Test before you implement** - TDD is mandatory
- **Verify before you claim completion** - Use verification-before-completion skill
- **Ask when uncertain** - Better to ask than assume
- **Document as you go** - Update SCRATCHPAD.md with decisions/blockers

---

## When Blocked

If you encounter any of these, STOP and document in SCRATCHPAD.md:

1. **Unclear requirements** - Ask for clarification
2. **Unexpected test failures** - Use systematic-debugging skill
3. **Conflicting requirements** - Ask for guidance
4. **Need to change baselines** - Request approval
5. **Missing dependencies** - Document and ask for help

**Never proceed with assumptions** - this is critical scientific infrastructure.

---

Now tell me: **What task are you working on next?**
