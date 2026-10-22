-- Migration: Backfill group_name for existing legacy token_timers
-- Priority order:
-- 1. 'ChatGPT' for model_name ILIKE '%chatgpt%'
-- 2. 'Gemini' for model_name ILIKE '%gemini%'
-- 3. 'Claude / GPT' for model_name ILIKE '%claude%' OR model_name ILIKE '%gpt%' (excluding ChatGPT)

-- ============================================================================
-- PREVIEW QUERY (Run this SELECT in Supabase SQL Editor first to verify rows):
-- ============================================================================
-- SELECT 
--   id, 
--   account_id, 
--   model_name,
--   group_name AS current_group_name,
--   CASE 
--     WHEN model_name ILIKE '%chatgpt%' THEN 'ChatGPT'
--     WHEN model_name ILIKE '%gemini%' THEN 'Gemini'
--     WHEN model_name ILIKE '%claude%' OR model_name ILIKE '%gpt%' THEN 'Claude / GPT'
--     ELSE 'No match (remains NULL)'
--   END AS proposed_group_name
-- FROM token_timers
-- WHERE group_name IS NULL
-- ORDER BY model_name;

-- ============================================================================
-- EXECUTION STATEMENTS (Do not run until you have verified the preview query):
-- ============================================================================

-- 1. ChatGPT models first (e.g. 'ChatGPT', 'ChatGPT Image')
UPDATE token_timers
SET group_name = 'ChatGPT'
WHERE group_name IS NULL 
  AND model_name ILIKE '%chatgpt%';

-- 2. Gemini models (e.g. 'Gemini Weekly', 'Gemini 5-hour', 'Gemini 1.5 Pro')
UPDATE token_timers
SET group_name = 'Gemini'
WHERE group_name IS NULL 
  AND model_name ILIKE '%gemini%';

-- 3. Claude & GPT models (e.g. 'Claude/GPT Weekly', 'Claude/GPT 5-hour', 'Claude 3.5 Sonnet', 'GPT-4o')
-- Note: 'chatgpt' rows were already assigned above, so '%gpt%' here only catches other GPT models.
UPDATE token_timers
SET group_name = 'Claude / GPT'
WHERE group_name IS NULL 
  AND (model_name ILIKE '%claude%' OR model_name ILIKE '%gpt%');
