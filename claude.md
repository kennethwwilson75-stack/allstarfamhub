# Instructions for Claude Code

## Project
All Star Fam Hub — unified family scheduling intelligence platform.
Production domain: allstarfamhub.com
GitHub repo: https://github.com/kennethwwilson75-stack/allstarfamhub

## Build Instructions
1. Read SPEC.md completely before writing any code
2. Follow the build order in Section 22 exactly, one step at a time
3. Do not skip steps or ask for clarification unless truly blocked
4. Make opinionated decisions where the spec has gaps
5. Use TypeScript strict mode throughout — no `any` without a comment
6. After completing each section, git commit with a clear message and move to the next
7. Run `pnpm build` and `pnpm lint` after each major section — fix errors before continuing
8. Never hardcode secrets — all values come from environment variables
9. Never commit the .env file — it is in .gitignore

## Stack Decisions (non-negotiable)
- Monorepo: pnpm workspaces
- API: Fastify + TypeScript
- DB: PostgreSQL via Prisma (Supabase)
- Queue: BullMQ on Redis
- Web: Next.js 14 App Router + Tailwind + shadcn/ui
- Mobile: Expo SDK 51 + Expo Router
- Scraping: Playwright (isolated Docker container)
- Auth: Supabase Auth

## Commit After Each Section
git add -A && git commit -m "build: [section name] complete"
git push origin main
EOF