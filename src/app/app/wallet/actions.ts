"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { requireUser } from "@/lib/session";
import { getCurrency } from "@/lib/wallet";
import { formatMoney } from "@/lib/pricing";
import { MAX_TOPUP_PENCE, MIN_TOPUP_PENCE, stripe, stripeConfigured, type TopUpMetadata } from "@/lib/stripe";

export type TopUpState = { error?: string; url?: string };

/** Pounds as typed ("50", "50.00", "£50") → integer pence. */
const amount = z
  .string()
  .trim()
  .transform((v) => v.replace(/[£,\s]/g, ""))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 50 or 50.00")
  .transform((v) => Math.round(parseFloat(v) * 100))
  .refine((n) => n >= MIN_TOPUP_PENCE, `The smallest top-up is ${formatMoney(MIN_TOPUP_PENCE)}`)
  .refine((n) => n <= MAX_TOPUP_PENCE, `The largest top-up is ${formatMoney(MAX_TOPUP_PENCE)}`);

/** Absolute origin, so the return URLs work on localhost and in production alike. */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
}

/**
 * Start a card top-up.
 *
 * Returns a Checkout URL for the browser to visit. Nothing is credited here —
 * the wallet moves only when the signed webhook arrives, because a client
 * reaching the success URL proves nothing about whether they paid.
 *
 * The client id goes in the session metadata rather than the return URL, so a
 * tampered URL cannot credit someone else's wallet.
 */
export async function startTopUp(_prev: TopUpState, fd: FormData): Promise<TopUpState> {
  const user = await requireUser();
  if (!stripeConfigured()) return { error: "Card payment isn't set up yet — pay your trainer directly." };

  const parsed = amount.safeParse(String(fd.get("amount") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid amount." };
  const pence = parsed.data;

  const s = stripe();
  if (!s) return { error: "Card payment isn't set up yet — pay your trainer directly." };

  const currency = await getCurrency();
  const base = await origin();
  const metadata: TopUpMetadata = { clientId: user.id, kind: "wallet_topup" };

  try {
    const session = await s.checkout.sessions.create({
      mode: "payment",
      // Prefilled so the receipt reaches them, and so Stripe can match a
      // returning customer.
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: pence,
            product_data: { name: "Training credit", description: "Added to your wallet balance" },
          },
        },
      ],
      metadata,
      // Mirrored onto the PaymentIntent so the dashboard shows who it was for.
      payment_intent_data: { metadata },
      success_url: `${base}/app/wallet?topup=success`,
      cancel_url: `${base}/app/wallet?topup=cancelled`,
    });

    if (!session.url) return { error: "Couldn't start the payment just now." };
    return { url: session.url };
  } catch (e) {
    console.error("[stripe] could not create checkout session", e);
    return { error: "Couldn't start the payment just now. Please try again." };
  }
}
