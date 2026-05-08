---
description: First-time project bootstrap (run after fresh clone)
---

# Bootstrap

Set up this project from a fresh clone. The user has just run `git clone` (or extracted the scaffold) and opened the project.

## Steps

1. **Verify prerequisites** (ask user to confirm):
   - Node.js 20+ installed (`node --version`)
   - pnpm installed (`pnpm --version`); if not, run `npm install -g pnpm`
   - Git configured

2. **Install dependencies**:
   ```
   pnpm install
   ```

3. **Set up environment**:
   - Copy `.env.example` to `.env.local`
   - Walk user through filling each value (explain each)

4. **Initial commit** (if git repo not yet initialized):
   ```
   git init
   git add .
   git commit -m "chore: initial scaffold"
   ```

5. **Verify build works**:
   ```
   pnpm typecheck
   pnpm lint
   pnpm build
   ```

6. **Start dev server**:
   ```
   pnpm dev
   ```
   Tell user to open http://localhost:5173

7. **Next steps suggestion**:
   - Set up GitHub remote and push
   - Connect Vercel for auto-deploys
   - Order test tablet
   - Begin with: implement Idle page

Walk the user through each step. Wait for confirmation before proceeding to the next.
