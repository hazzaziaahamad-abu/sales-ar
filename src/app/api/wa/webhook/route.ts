import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Inbound webhook from the OpenWA gateway.
 *
 * The gateway signs every payload with HMAC-SHA256 over the raw request body
 * using WA_WEBHOOK_SECRET, sent in the `X-OpenWA-Signature` header as
 * `sha256=<hex>`. We verify that before trusting the event.
 *
 * NOTE: this endpoint must NOT require a logged-in user — it is called
 * server-to-server by the gateway. Auth is the HMAC signature instead.
 */

const SECRET = process.env.WA_WEBHOOK_SECRET;

function verifySignature(rawBody: string, header: string | null): boolean {
  if (!SECRET || !header) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-openwa-signature") ??
    req.headers.get("X-OpenWA-Signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    sessionId?: string;
    data?: Record<string, unknown>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  switch (payload.event) {
    case "message.received": {
      const m = payload.data ?? {};
      // TODO: persist to a `wa_messages` table / forward to the UI.
      console.log("[wa] message.received", {
        from: m.from,
        body: m.body,
        type: m.type,
      });
      break;
    }
    case "session.status": {
      console.log("[wa] session.status", payload.data?.status);
      break;
    }
    default:
      console.log("[wa] unhandled event", payload.event);
  }

  // Always ack quickly so the gateway doesn't retry.
  return NextResponse.json({ received: true });
}
