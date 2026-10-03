-- ===================== Bazarville — editable homepage "Questions" ticker =====================
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run even if you've already run earlier migrations — the statement below is a no-op if
-- already applied.
--
-- What this adds:
--   - settings.homepage_questions — the quick-question chips that scroll on the homepage, right
--     under the "What are you shopping for today?" heading. Editable from Admin → Site Settings →
--     Homepage quick questions (one per line) — no need to run SQL again after this.

alter table public.settings
  add column if not exists homepage_questions jsonb not null default '["What can I get under ₹500?","What can I get under ₹5,000?","Best gifts for employee onboarding?","Diwali gifting ideas on a budget?","What''s trending for client gifting?","How can we help you today?"]';

update public.settings set
  homepage_questions = '["What can I get under ₹500?","What can I get under ₹5,000?","Best gifts for employee onboarding?","Diwali gifting ideas on a budget?","What''s trending for client gifting?","How can we help you today?"]'
where id = 1 and homepage_questions is null;
