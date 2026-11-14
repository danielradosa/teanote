import { serve } from "https://deno.land/std/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-10-29.clover",
});

serve(async (req) => {
  // --- handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ code: 401, message: "Missing authorization header" }), {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
      });

    const { userId, priceId } = await req.json();
    if (!userId || !priceId)
      return new Response(JSON.stringify({ error: "userId and priceId required" }), { status: 400 });

    // verify token
    const supaAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: profile, error } = await supaAuth
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (error || !profile)
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: profile.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `https://app.teanote.xyz/account?success=true`,
      cancel_url: `https://app.teanote.xyz/account?cancelled=true`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});