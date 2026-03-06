---
user-invocable: true
description: Review changed code for reuse, quality, and efficiency, then fix any issues found.
---

# Simplify

Review changed code for reuse, quality, and efficiency, then fix any issues found.

## Instructions

1. Identify all recently changed files using `git diff` and `git status`
2. Review each changed file for:
   - Code reuse opportunities (duplicated logic that could be extracted)
   - Code quality issues (unclear naming, unnecessary complexity, missing error handling)
   - Efficiency problems (unnecessary re-renders, redundant computations, N+1 patterns)
3. Fix any issues found directly in the code
4. Summarize what was changed and why
