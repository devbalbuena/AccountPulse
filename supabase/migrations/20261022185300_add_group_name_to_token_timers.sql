-- Migration: Add nullable group_name column to token_timers
-- Allows grouping timers (e.g. Gemini Weekly + Gemini 5h under 'Gemini')
ALTER TABLE token_timers 
ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Optional index for faster group filtering
CREATE INDEX IF NOT EXISTS idx_token_timers_group_name ON token_timers(group_name);
