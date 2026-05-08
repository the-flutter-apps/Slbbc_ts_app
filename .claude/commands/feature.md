---
description: Plan and implement a new feature with proper checks
---

# Implement Feature

You are about to implement: $ARGUMENTS

Follow this protocol:

## 1. Confirm Understanding
Restate the feature in one paragraph. List any assumptions you're making.

## 2. Identify Relevant Context
Which `.claude/context/*.md` files apply to this feature? Read them now if you haven't.

## 3. Plan
Produce a brief plan:
- Files to create or modify (with paths)
- Order of implementation
- Tests to add
- Any external dependencies needed

## 4. Confirm with User
Pause for user approval before writing code.

## 5. Implement Incrementally
- Make the smallest meaningful change
- Run `pnpm typecheck` after each meaningful change
- Run `pnpm lint` before declaring done
- Add unit tests for any logic in `src/lib/`

## 6. Verify
- All types pass
- All lints pass
- All tests pass
- Manual smoke test described to user

## 7. Suggest Next Steps
What comes next in the project? Anything to update in CLAUDE.md or context docs?
