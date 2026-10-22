-- Preserve the exact slide text sent to Gamma beside the paid-generation ledger.
-- This is audit evidence only; it never changes the generated lesson content.
alter table public.gamma_generations
  add column if not exists source_snapshot jsonb;

comment on column public.gamma_generations.source_snapshot is
  'Exact pre-Gamma slide snapshot used for content-preservation validation';
