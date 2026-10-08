import Stripe from "stripe";

/**
 * Card top-ups.
 *
 * The wallet itself is ledger-only — the trainer records money that arrived by
 * bank transfer or cash. This adds one path where the money arrives by card
 * instead, and it is deliberately the only one: sessions are still charged
 * against the wallet balance, never against a saved card. That keeps us out of
 * off-session charging, SCA retries and failed-payment recovery.
 *
 * Nothing here trusts the browser. A Checkout session returning to a success
 * URL proves nothing — the client could simply visit that URL. The wallet is
 * credited only by the webhook, verified against the signing secret.
 */

/** Configured only when both keys are present, so a half-set .env disables it cleanly. */
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

let client: Stripe | null = null;

/** The SDK, or null when card payment is not configured. */
export function stripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Smallest and largest top-up we will accept, in pence. */
export const MIN_TOPUP_PENCE = 500;
export const MAX_TOPUP_PENCE = 200_000;

/**
 * Metadata carried on the Checkout session and read back from the webhook.
 * The client id travels here rather than in the return URL so a tampered URL
 * cannot credit someone else's wallet.
 */
export type TopUpMetadata = { clientId: string; kind: "wallet_topup" };

export function isTopUpMetadata(m: Stripe.Metadata | null | undefined): m is Stripe.Metadata & TopUpMetadata {
  return !!m && m.kind === "wallet_topup" && typeof m.clientId === "string" && m.clientId.length > 0;
}
