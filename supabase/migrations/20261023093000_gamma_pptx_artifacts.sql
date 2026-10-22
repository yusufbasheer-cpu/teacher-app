-- Private, staging-only artifact storage for validated Gamma PPTX exports.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gamma-pptx-artifacts', 'gamma-pptx-artifacts', false, 52428800, array['application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.gamma_generations
  add column if not exists artifact_path text,
  add column if not exists validation_report jsonb,
  add column if not exists request_metadata jsonb,
  add column if not exists theme_id text,
  add column if not exists image_source text,
  add column if not exists image_style text,
  add column if not exists duration_ms integer,
  add column if not exists export_metadata jsonb;

comment on column public.gamma_generations.artifact_path is 'Private storage path; never a public URL';
comment on column public.gamma_generations.request_metadata is 'Sanitized Gamma request metadata without secrets or slide text';

