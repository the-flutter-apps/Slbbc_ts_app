---
description: Review uncommitted changes and suggest improvements
---

# Review Changes

Review the current uncommitted changes (`git diff` and `git status`).

For each modified file, evaluate:

## Correctness
- Does the code do what it's supposed to do?
- Are edge cases handled?
- Are async errors caught?

## Consistency with CLAUDE.md
- Tech stack adherence (no banned libraries)
- Coding standards (TypeScript strict, function components, Tailwind only, etc.)
- File/folder conventions

## Performance
- Any unnecessary re-renders?
- Heavy operations in render path?
- Memory leaks (event listeners, timers, streams not cleaned up)?

## Kiosk-specific concerns
- Works offline?
- Handles slow network gracefully?
- UI works on tablet touch (no hover-only interactions)?
- Audio/visual feedback for illiterate users?

## Security
- No secrets in code
- API responses validated before use
- User input sanitized

## Test Coverage
- New logic in `src/lib/` has tests?
- Component changes have updated component tests?

## Output Format
Group findings by severity:
- 🔴 **Must fix** — bugs, security issues, broken contracts
- 🟡 **Should fix** — quality issues, performance, consistency
- 🟢 **Consider** — minor suggestions, alternatives

If everything looks good, say so clearly. Don't manufacture issues.
