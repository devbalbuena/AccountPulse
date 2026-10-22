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

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Resend API error (${res.status}): ${errorBody}`);
  }
  return res.json();
}

Deno.serve(async (_req) => {
  try {
    const now = Date.now();

    // Query non-deleted timers belonging to non-deleted accounts
    const { data: timers, error } = await supabase
      .from("token_timers")
      .select(`
        id,
        account_id,
        model_name,
        group_name,
        interval_hours,
        next_due_at,
        last_refreshed_at,
        last_notified_at,
        notify_on_ready,
        accounts!inner (
          id,
          email,
          platform,
          type,
          user_id,
          deleted_at,
          profiles (
            email,
            name
          )
        )
      `)
      .is("deleted_at", null)
      .is("accounts.deleted_at", null);

    if (error) throw error;
    if (!timers || timers.length === 0) {
      return new Response(JSON.stringify({ message: "No active timers found.", count: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Group timers by account_id and group_name (fallback to model_name)
    const groupsMap = new Map<string, {
      account: any;
      groupName: string;
      timers: typeof timers;
    }>();

    for (const timer of timers) {
      const account = timer.accounts as any;
      if (!account || account.deleted_at) continue;

      const groupName = timer.group_name || timer.model_name || "Default";
      const groupKey = `${account.id}::${groupName}`;

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, { account, groupName, timers: [] });
      }
      groupsMap.get(groupKey)!.timers.push(timer);
    }

    // Fetch user notification preferences for all relevant users
    const userIds = [...new Set(Array.from(groupsMap.values()).map(g => g.account.user_id))];
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("user_id, account_expiry")
      .in("user_id", userIds);

    const userSettingsMap = new Map<string, boolean>();
    (userSettings || []).forEach(s => {
      userSettingsMap.set(s.user_id, s.account_expiry);
    });

    let processed = 0;

    for (const { account, groupName, timers: groupTimers } of groupsMap.values()) {
      // 1. Check user-level "Token Ready Alerts" preference (default true if not set)
      const userAlertsEnabled = userSettingsMap.get(account.user_id) ?? true;
      if (!userAlertsEnabled) continue;

      // 2. Check group-level opt-in flag (notify_on_ready)
      const isGroupOptedIn = groupTimers.some(t => t.notify_on_ready === true);
      if (!isGroupOptedIn) continue;

      // 3. Must have at least one timer with a non-null last_refreshed_at
      const hasRefreshed = groupTimers.some(t => t.last_refreshed_at !== null);
      if (!hasRefreshed) continue;

      // 4. Calculate ready_at = max(next_due_at) over the group's non-deleted timers
      const dueTimes = groupTimers.map(t => t.next_due_at ? new Date(t.next_due_at).getTime() : 0);
      const readyAtMs = Math.max(...dueTimes);

      // Condition: now >= ready_at (all timers in the group are due)
      if (now < readyAtMs) continue;

      // 5. The group's last_notified_at must be NULL or < ready_at
      const notifiedTimes = groupTimers
        .map(t => t.last_notified_at ? new Date(t.last_notified_at).getTime() : 0);
      const groupLastNotifiedAtMs = Math.max(...notifiedTimes);

      if (groupLastNotifiedAtMs >= readyAtMs) {
        // Already notified for this cooldown cycle
        continue;
      }

      // Group is eligible!
      const timerIds = groupTimers.map(t => t.id);
      const previousStamps = groupTimers.map(t => ({ id: t.id, last_notified_at: t.last_notified_at }));
      const claimTimestamp = new Date().toISOString();
      const readyAtIso = new Date(readyAtMs).toISOString();

      // CLAIM-THEN-SEND: Perform conditional UPDATE ... RETURNING first to claim atomic lock
      const { data: claimedRows, error: claimError } = await supabase
        .from("token_timers")
        .update({ last_notified_at: claimTimestamp })
        .in("id", timerIds)
        .or(`last_notified_at.is.null,last_notified_at.lt.${readyAtIso}`)
        .select("id");

      if (claimError || !claimedRows || claimedRows.length === 0) {
        // Another concurrent worker claimed the group
        continue;
      }

      // Retrieve user profile / recipient email
      const profile = account.profiles as any;
      const userEmail = profile?.email || account.email;
      const userName = profile?.name || userEmail;

      try {
        // Send email via Resend
        await sendEmail(
          userEmail,
          `✓ Quota ready: ${account.platform} (${account.email})`,
          `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #0f1117; color: #e2e8f0; padding: 2rem; border-radius: 12px; border: 1px solid #1e293b;">
            <h1 style="color: #10b981; font-size: 1.25rem; margin-bottom: 0.5rem;">AccountPulse</h1>
            <h2 style="font-size: 1.1rem; color: #e2e8f0; margin-bottom: 1.5rem;">Quota Ready to Use</h2>
            <div style="background: #1a1d27; border: 1px solid #2e3248; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
              <p style="margin: 0 0 0.25rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Ready Account</p>
              <p style="margin: 0; font-weight: 600; font-size: 1.05rem; font-family: monospace;">${account.email}</p>
              <p style="margin: 0.5rem 0 0; font-size: 0.875rem; color: #10b981; font-weight: 500;">
                ${account.platform} · <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${groupName} Ready</span>
              </p>
            </div>
            <p style="color: #94a3b8; font-size: 0.875rem; line-height: 1.6;">
              Hi ${userName}, cooldown on your <strong style="color: #e2e8f0;">${account.platform}</strong> account 
              (<strong style="color: #e2e8f0;">${account.email}</strong>) for group <strong style="color: #10b981;">${groupName}</strong> has completed. All timers in this group are ready for use.
            </p>
            <a href="${Deno.env.get("APP_URL") || "http://localhost:5173"}/accounts" 
               style="display: inline-block; margin-top: 1.25rem; padding: 0.65rem 1.25rem; background: #10b981; color: #fff; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.875rem;">
              Open Accounts & Copy Email →
            </a>
            <p style="margin-top: 2rem; color: #475569; font-size: 0.75rem;">AccountPulse · Token & Subscription Tracker</p>
          </div>
          `
        );

        // Record in-app notification
        await supabase.from("notifications").insert({
          user_id: account.user_id,
          message: `Your ${account.platform} account (${account.email}) quota for ${groupName} is now ready to use.`,
          account_id: account.id,
          is_read: false,
        });

        processed++;
      } catch (sendError) {
        console.error(`Resend dispatch failed for group ${groupName} on account ${account.email}:`, sendError);

        // Roll back / restore previous last_notified_at stamps so it can be retried on next run
        for (const prev of previousStamps) {
          await supabase
            .from("token_timers")
            .update({ last_notified_at: prev.last_notified_at })
            .eq("id", prev.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Done.", processedGroups: processed }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
