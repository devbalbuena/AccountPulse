-- Migration: Add last_notified_at and notify_on_ready columns to token_timers (UNRUN)
-- notify_on_ready is a group-level opt-in flag (default true for weekly groups, false for 5-hour groups)
-- Dropped partial index per requirement

ALTER TABLE token_timers
ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notify_on_ready BOOLEAN DEFAULT false;

-- Default opt-in: weekly timers (interval >= 24h) have notify_on_ready = true
UPDATE token_timers
SET notify_on_ready = true
WHERE interval_hours >= 24;

-- Synchronize group-level flag: if any timer in a group on an account is weekly,
-- all sibling timers in that same group inherit notify_on_ready = true
UPDATE token_timers t
SET notify_on_ready = true
FROM token_timers t2
WHERE t.account_id = t2.account_id
  AND COALESCE(t.group_name, t.model_name) = COALESCE(t2.group_name, t2.model_name)
  AND t2.notify_on_ready = true;
