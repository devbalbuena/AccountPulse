import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "AccountPulse <notifications@yourdomain.com>",
      to: [to],
      subject,
      html,
    }),
  });
  return res.json();
}

Deno.serve(async (_req) => {
  try {
    // Find all due token timers with account and user info
    const { data: dueTimers, error } = await supabase
      .from("token_timers")
      .select(`
        id,
        interval_hours,
        next_due_at,
        accounts (
          id,
          email,
          platform,
          type,
          user_id,
          profiles (
            email,
            name
          )
        )
      `)
      .lte("next_due_at", new Date().toISOString())
      .is("deleted_at", null);

    if (error) throw error;
    if (!dueTimers || dueTimers.length === 0) {
      return new Response(JSON.stringify({ message: "No timers due.", count: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const timer of dueTimers) {
      const account = timer.accounts as any;
      if (!account) continue;

      const profile = account.profiles as any;
      const userEmail = profile?.email;
      if (!userEmail) continue;

      const userName = profile?.name || userEmail;

      // Send email via Resend
      await sendEmail(
        userEmail,
        `⏰ Token refresh needed: ${account.platform}`,
        `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #0f1117; color: #e2e8f0; padding: 2rem; border-radius: 12px;">
          <h1 style="color: #6366f1; font-size: 1.25rem; margin-bottom: 0.5rem;">AccountPulse</h1>
          <h2 style="font-size: 1rem; color: #e2e8f0; margin-bottom: 1.5rem;">Token Refresh Required</h2>
          <div style="background: #1a1d27; border: 1px solid #2e3248; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
            <p style="margin: 0 0 0.5rem; color: #94a3b8; font-size: 0.875rem;">Account</p>
            <p style="margin: 0; font-weight: 600; font-size: 1rem;">${account.email}</p>
            <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: #6366f1;">${account.platform} · ${account.type}</p>
          </div>
          <p style="color: #94a3b8; font-size: 0.875rem; line-height: 1.6;">
            Hi ${userName}, your <strong style="color: #e2e8f0;">${account.platform}</strong> account 
            <strong style="color: #e2e8f0;">${account.email}</strong> token has expired and needs to be refreshed.
          </p>
          <a href="${Deno.env.get("APP_URL")}/accounts" 
             style="display: inline-block; margin-top: 1.25rem; padding: 0.625rem 1.25rem; background: #6366f1; color: #fff; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.875rem;">
            Go to Accounts →
          </a>
          <p style="margin-top: 2rem; color: #334155; font-size: 0.75rem;">AccountPulse · Token & Subscription Tracker</p>
        </div>
        `
      );

      // Insert notification record
      await supabase.from("notifications").insert({
        user_id: account.user_id,
        message: `Your ${account.platform} account (${account.email}) token needs to be refreshed.`,
        account_id: account.id,
        is_read: false,
      });

      processed++;
    }

    return new Response(
      JSON.stringify({ message: "Done.", processed }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
