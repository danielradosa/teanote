import { serve } from "https://deno.land/std/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-10-29.clover",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  try {
    const event = await stripe.webhooks.constructEventAsync(
      body,
      sig!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );

    console.log("⚡ Received Stripe event:", event.type);

    // DB update helper
    async function updateSubscription(
      email: string | null,
      subscribed: boolean,
      start?: number | null,
      end?: number | null
    ) {
      if (!email) return;

      const subscription_start = start != null ? new Date(start * 1000).toISOString() : null;
      const subscription_end = end != null ? new Date(end * 1000).toISOString() : null;

      const updateData: Record<string, any> = {
        is_subscribed: subscribed,
        subscription_start,
        subscription_end,
      };

      if (!subscribed) {
        updateData.subscription_start = null;
        updateData.subscription_end = null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("email", email);

      if (error) console.error(`❌ Failed DB update for ${email}:`, error);
      else
        console.log(
          `✅ Updated subscription for ${email}:`,
          subscribed ? `active (${subscription_end ?? "forever"})` : "inactive"
        );
    }

    //Helper to get accurate start/end from subscription
    function getAccuratePeriod(sub: any, schedule?: any) {
      // Use schedule phases if present
      if (schedule?.phases?.length) {
        const phase = schedule.phases[0];
        return {
          start: phase.start_date ?? sub.start_date,
          end: phase.end_date ?? sub.current_period_end ?? null,
        };
      }

      // Fallback to subscription items
      const item = sub.items?.data?.[0];
      return {
        start: item?.current_period_start ?? sub.start_date,
        end: item?.current_period_end ?? null,
      };
    }

    // Handle Stripe events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const email = session.customer_email;
        const subId = session.subscription;
        if (!email || !subId) break;

        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["items.data.price.recurring"],
        });

        const { start, end } = getAccuratePeriod(sub);
        await updateSubscription(email, true, start, end);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const email = invoice.customer_email;
        const subId = invoice.subscription;
        if (!email || !subId) break;

        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["items.data.price.recurring"],
        });

        const { start, end } = getAccuratePeriod(sub);
        await updateSubscription(email, true, start, end);
        break;
      }

      case "invoice.payment_failed":
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const customer = await stripe.customers.retrieve(sub.customer);
        const email = (customer as any).email;
        await updateSubscription(email, false);
        break;
      }

      case "customer.subscription.updated":
      case "subscription_schedule.updated": {
        const sub = event.data.object as any;

        // Fetch schedule if available
        let schedule: any = null;
        try {
          if (sub.schedule) {
            schedule = await stripe.subscriptionSchedules.retrieve(sub.schedule);
          }
        } catch (e) {
          console.warn("⚠️ Failed to fetch subscription schedule, fallback:", e);
        }

        const customer = await stripe.customers.retrieve(sub.customer);
        const email = (customer as any).email;

        const { start, end } = getAccuratePeriod(sub, schedule);

        // Only update DB if start or end is defined
        if (start === undefined && end === undefined) {
          console.log("ℹ️ subscription_schedule.updated has undefined dates, skipping DB update");
          break;
        }

        console.log("📦 Subscription update (safe):", { id: sub.id, status: sub.status, start, end });
        await updateSubscription(email, sub.status === "active", start, end);
        break;
      }

      default:
        console.log("ℹ️ Event type not handled:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    console.error("❌ Webhook error:", err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});