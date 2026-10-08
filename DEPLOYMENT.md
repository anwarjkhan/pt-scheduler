# Deployment

Hosted on **Vercel**, backed by **Prisma Postgres**. `main` is production; `dev` is
where the work happens.

## Releasing to production

```bash
git switch main && git merge dev && git push && git switch dev
```

Pushing to `main` is what triggers the production build — nothing else deploys.

Before merging, check:

1. **CI is green** on `dev` — [Actions](https://github.com/anwarjkhan/pt-scheduler/actions)
2. **The preview looks right** — every `dev` push gets its own Vercel URL; click through
   the actual change there

Then watch the production build in Vercel's **Deployments** tab. If it fails, production
keeps serving the previous version rather than going down.

## Day-to-day

```bash
git switch dev
# commit and push as often as you like — previews only, production untouched
```

Notes:

- **Don't commit directly on `main`.** If you do, `dev` falls behind and the next merge
  can conflict. Resync with `git switch dev && git merge main`.
- **If `git merge dev` opens an editor**, save and close it. It won't when `dev` is a
  straight line ahead of `main` — that fast-forwards silently.

## What happens on a deploy

`vercel-build` runs `prisma migrate deploy && next build`, so **any new migration is
applied to the production database during the build**. That is irreversible against live
data — pause on it when a merge includes one.

CI runs plain `next build` with a dummy `DATABASE_URL`, so it never touches the database.

## Environment variables

Set in Vercel under Settings → Environment Variables. Changing one does **not** affect
existing deployments — redeploy for it to take effect.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Injected by the Prisma Postgres integration |
| `AUTH_SECRET` | Required in production, or Auth.js won't issue sessions |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Enables Google sign-in; add the production callback URI to the OAuth client (`/api/auth/callback/google`) |
| `PT_EMAIL` | The account promoted to trainer on first sign-in |
| `DEV_LOGIN`, `DEMO_MODE`, `DEMO_PASSCODE` | Passcode-gated demo sign-in — see below |
| `GOOGLE_MAPS_SERVER_KEY` | Optional; without it, postcodes.io and straight-line estimates are used |
| `DAILY_API_KEY` | Optional; without it, online sessions book as normal but show no Join button |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Optional, but needed **together**; without both, the card top-up button is hidden and wallets stay ledger-only |

## Card top-ups

Clients can top up their wallet by card from `/app/wallet`. Both Stripe variables
must be set, or the button does not appear and the trainer records payments by hand
as before.

The wallet is credited by the **webhook**, never by the browser returning to the
success URL — that only proves someone loaded a page. Point a Stripe endpoint at:

```
https://<your-domain>/api/stripe/webhook
```

subscribed to `checkout.session.completed`, and put its signing secret in
`STRIPE_WEBHOOK_SECRET`. Locally, use the Stripe CLI instead:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

It prints a `whsec_…` secret for your `.env`. Test card `4242 4242 4242 4242`,
any future expiry and CVC.

Stripe retries a webhook until it gets a 2xx and may deliver the same event twice;
a unique index on `stripeSessionId` means a replay credits the wallet only once.
Card entries cannot be edited in the app, so the ledger keeps matching Stripe.

Sessions are charged against the wallet **balance**, never against a saved card.
Off-session charging would bring SCA and failed-payment recovery with it, and is
deliberately out of scope.

## Demo access

With no Google OAuth client configured, setting `DEV_LOGIN=true`, `DEMO_MODE=true` and a
`DEMO_PASSCODE` enables password-free sign-in: any seeded email plus the shared passcode.
`authorize()` rejects a wrong passcode, so the deployment is not an open door.

It is still a demo mechanism — the passcode is shared, not personal, and whoever has it
can sign in as the trainer. Configure Google sign-in before real client data goes in.

## Known gaps

- **Preview shares the production database.** A preview build runs `vercel-build` too, so
  a migration on `dev` applies to live data on the next preview deploy — not just on
  release. Give Preview its own `DATABASE_URL` before adding migrations on a branch.
- **Local `.env` points at production.** `npm run dev` reads and writes the live database.
  The original SQLite config is saved at `.env.backup`.
