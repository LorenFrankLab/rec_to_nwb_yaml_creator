# September 15 review archive

Each report describes the revision named in its heading. Findings and browser captures are historical
observations; they do not all describe the current app.

| Report | Reviewed revision | Scope |
| --- | --- | --- |
| [Revision 5](REVISION_5_REVIEW.md) | See report | Restore artifact cleanup |
| [Revision 6](REVISION_6_REVIEW.md) | `036b9591` | Verification of the restore-cleanup correction |
| [Scientist workflow, UX, and architecture](WORKFLOW_UX_ARCHITECTURE_REVIEW.md) | `036b9591` | Daily entry, retrospective imports, metadata ownership, and downstream consumers |
| [Workflow fixes](WORKFLOW_FIX_REVIEW.md) | `dd62f6ed` | Original corrections and remaining findings R1–R5 |
| [Workflow follow-up](WORKFLOW_FOLLOWUP_REVIEW.md) | `90a4b164` | Closure of R1–R5 and discovery of imported-task loss R6 |

R6 was subsequently fixed in `14985169`; the follow-up report records the regression coverage and
verification after that fix.

The evidence directories retain reproduction scripts, fixture inputs, observed JSON results, and
screenshots. Screen-text captures have trailing whitespace trimmed for storage in Git. Generated
`.log` files remain excluded by the repository ignore rules. Some corpus diagnostics require the
original local datasets; their paths and prerequisites are documented in the reports and scripts.
