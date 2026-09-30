-- ===================== Bazarville — editable Purpose/Occasion/Profession lists =====================
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to run even if you've already run earlier migrations — every statement below is a no-op if
-- already applied (checks "if not exists" / uses default values only when the row is missing them).
--
-- What this adds:
--   - settings.purposes            — the Purpose dropdown's options (product form + live site filter)
--   - settings.occasions           — the Occasion dropdown's options (product form + live site filter)
--   - settings.custom_professions  — any Profession the admin adds beyond the built-in preset list
-- Admin can add more to each of these any time from the product form ("+ Add new purpose/occasion/profession")
-- — no need to run SQL again for that.

alter table public.settings
  add column if not exists purposes jsonb not null default '["Client Gifts","Employee / Staff Gifts","Office & Workplace","Corporate Events","Awards & Recognition","Onboarding / Joining Kits","Marketing & Promotion","Branding & Corporate Identity","Conferences / Seminars / Workshops","Dealer / Distributor Gifts","Employee Appreciation","Welcome / Gift Kits","Festive Gifting","Travel / Utility Gifting","Team / Group Gifting"]',
  add column if not exists occasions jsonb not null default '["Diwali","New Year","Holi","Raksha Bandhan","Christmas","Eid","Independence Day","Republic Day","Company Anniversary","Annual Day","Product Launch","Corporate Events","Conferences & Exhibitions","Employee Joining / Onboarding","Employee Recognition & Awards","Employee Farewell","Client / Dealer Meets","Team Outings & Celebrations"]',
  add column if not exists custom_professions jsonb not null default '[]';

-- If your existing settings row (id=1) was created before this migration and somehow ended up with
-- NULL in these columns (shouldn't normally happen with the defaults above, but just in case):
update public.settings set
  purposes = '["Client Gifts","Employee / Staff Gifts","Office & Workplace","Corporate Events","Awards & Recognition","Onboarding / Joining Kits","Marketing & Promotion","Branding & Corporate Identity","Conferences / Seminars / Workshops","Dealer / Distributor Gifts","Employee Appreciation","Welcome / Gift Kits","Festive Gifting","Travel / Utility Gifting","Team / Group Gifting"]'
where id = 1 and purposes is null;

update public.settings set
  occasions = '["Diwali","New Year","Holi","Raksha Bandhan","Christmas","Eid","Independence Day","Republic Day","Company Anniversary","Annual Day","Product Launch","Corporate Events","Conferences & Exhibitions","Employee Joining / Onboarding","Employee Recognition & Awards","Employee Farewell","Client / Dealer Meets","Team Outings & Celebrations"]'
where id = 1 and occasions is null;

update public.settings set custom_professions = '[]' where id = 1 and custom_professions is null;
