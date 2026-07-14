This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

Unit tests for the dashboard's business-logic layer are written with [Jest](https://jestjs.io/)
(configured via `next/jest`, jsdom environment).

```bash
npm test              # run the full suite
npm run test:watch    # watch mode
npm run test:coverage # run with a coverage report
```

Tests live under `tests/` and mirror the `src/lib/` structure. They cover:

- **`utils/format`** — money/percent/date formatting, Saudi-timezone helpers, date-range bounds, phone formatting
- **`utils/value-maps`** — Excel→canonical stage/source/renewal-status mapping (incl. identity stability)
- **`utils/constants`** — KPI status thresholds and constant integrity
- **`kpi-calculations`** — deal credit distribution and per-employee aggregation
- **`gamification`** — leaderboard scoring, badge awarding, star-employee selection
- **`ai/scoring`** — weighted performance-score computation (with caps & guards)
- **`ai/alerts`** — critical/warning/opportunity alert generation and ordering
- **`auto-followup`** — follow-up rule matching, dedup against open tasks, task building
- **`tasks/schedule`** — timezone-aware next-run computation and Arabic schedule descriptions
- **`tasks/card`** — HMAC-signed task-card token sign/verify (tamper detection)
- **`permissions`** — super-admin short-circuit, permission caching/invalidation (Supabase mocked)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# sales-ar
