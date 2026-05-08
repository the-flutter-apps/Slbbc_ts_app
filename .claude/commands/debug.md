---
description: Diagnose a problem methodically
---

# Debug

The user is reporting this issue: $ARGUMENTS

Diagnose methodically:

## 1. Understand the Symptom
- What exactly is happening?
- What did the user expect instead?
- When did it start? (after a change? always?)

## 2. Gather Evidence (ask the user to run these if needed)
- Relevant error messages from browser console?
- Network tab showing failing requests?
- `pnpm typecheck` output?
- Recent git changes via `git log --oneline -10`?

## 3. Form Hypotheses
List 2-4 plausible causes, ranked by likelihood. For each, state:
- Why it could cause this symptom
- How to verify or rule it out

## 4. Verify Top Hypothesis
Read the relevant code. Confirm or rule out.

## 5. Fix
- Apply minimal fix
- Add a test that reproduces the bug (so it can't regress)
- Verify fix doesn't break other tests

## 6. Explain
Tell the user:
- What was wrong
- Why it was wrong
- What you changed
- How to prevent similar bugs

Do not start fixing before completing steps 1-3. Premature fixes waste time.
