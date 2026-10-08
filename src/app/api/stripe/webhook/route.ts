import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { isTopUpMetadata, stripe, stripeConfigured } from "@/lib/stripe";

/**
 * Where a card top-up actually credits the wallet.
 *
 * Deliberately not the Checkout success URL: that only proves the browser
 * reached a page, which anyone could do by typing it. Stripe signs this
 * request, we verify it against the webhook secret, and only then is the
 * ledger touched.
 *
 * Stripe retries a webhook until it gets a 2xx, and may deliver the same
 * event more than once. The unique index on stripeSessionId makes that safe:
 * the second insert loses and the wallet is credited once.
 */
export async function POST(req: NextRequest) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret || !stripeConfigured()) {
    return NextResponse.json({ error: "Card payment isn't configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // The signature covers the exact bytes Stripe sent, so the body must be read
  // raw — parsing it first would change it and the check would fail.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await s.webhooks.constructEventAsync(raw, signature, secret);
  } catch (e) {
    // A bad signature is either a misconfigured secret or someone poking at
    // the endpoint. Either way: refuse, and do not retry.
    console.error("[stripe] signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledge everything else so Stripe stops retrying it.
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Only credit a session that is actually paid. Checkout can complete with
  // payment still pending for some methods.
  if (session.payment_status !== "paid") return NextResponse.json({ received: true });
  if (!isTopUpMetadata(session.metadata)) return NextResponse.json({ received: true });

  const amount = session.amount_total;
  if (!amount || amount <= 0) return NextResponse.json({ received: true });

  const clientId = session.metadata.clientId;
  const client = await db.user.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) {
    console.error("[stripe] top-up for unknown client", clientId);
    // 200: retrying will not conjure the user up.
    return NextResponse.json({ received: true });
  }

  try {
    await db.walletEntry.create({
      data: {
        clientId,
        amountPence: amount,
        currency: (session.currency ?? "gbp").toUpperCase(),
        reason: "TOPUP",
        note: "Card payment",
        createdById: clientId,
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
      },
    });
  } catch (e) {
    // P2002 on stripeSessionId: this event has already been processed. That is
    // the guard working, so report success and stop the retries.
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Anything else is ours to fix — 500 so Stripe retries later.
    console.error("[stripe] could not record top-up", e);
    return NextResponse.json({ error: "Could not record the payment" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
