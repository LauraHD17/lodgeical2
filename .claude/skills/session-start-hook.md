---
user-invocable: true
description: Creating and developing startup hooks for Claude Code on the web.
---

# Session Start Hook

Use this skill to set up a repository for Claude Code on the web by creating a SessionStart hook to ensure the project can run tests and linters during web sessions.

## Instructions

1. Check if a `.claude/hooks/` directory exists; create it if not
2. Create or update the session start hook configuration
3. Ensure the hook installs dependencies and validates the environment
4. Verify the hook runs tests and linters correctly
