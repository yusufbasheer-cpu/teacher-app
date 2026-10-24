select jsonb_build_object(
  'identity', jsonb_build_object(
    'database', current_database(),
    'user', current_user,
    'table_oid', c.oid,
    'owner', pg_get_userbyid(c.relowner)
  ),
  'table', jsonb_build_object(
    'schema', n.nspname,
    'name', c.relname,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity
  ),
  'columns', (
    select jsonb_agg(jsonb_build_object(
      'name', cols.column_name,
      'type', cols.data_type,
      'udt', cols.udt_name,
      'nullable', cols.is_nullable,
      'default', cols.column_default
    ) order by cols.ordinal_position)
    from information_schema.columns cols
    where cols.table_schema = 'public'
      and cols.table_name = 'saved_lessons'
  ),
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', con.conname,
      'type', con.contype,
      'definition', pg_get_constraintdef(con.oid)
    ) order by con.conname), '[]'::jsonb)
    from pg_constraint con
    where con.conrelid = 'public.saved_lessons'::regclass
  ),
  'policies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', policyname,
      'permissive', permissive,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'check', with_check
    ) order by policyname), '[]'::jsonb)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_lessons'
  ),
  'grants', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'grantee', grantee,
      'privilege', privilege_type,
      'grantable', is_grantable
    ) order by grantee, privilege_type), '[]'::jsonb)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'saved_lessons'
      and grantee in ('anon', 'authenticated', 'service_role')
  ),
  'referencing_functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'schema', q.schema_name,
      'name', q.function_name,
      'security_definer', q.security_definer,
      'arguments', q.arguments
    ) order by q.schema_name, q.function_name), '[]'::jsonb)
    from (
      select
        pn.nspname as schema_name,
        p.proname as function_name,
        p.prosecdef as security_definer,
        pg_get_function_identity_arguments(p.oid) as arguments,
        pg_get_functiondef(p.oid) as definition
      from pg_proc p
      join pg_namespace pn on pn.oid = p.pronamespace
      where p.prokind in ('f', 'p')
    ) q
    where q.definition ilike '%saved_lessons%'
  )
) as saved_lessons_metadata
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'saved_lessons';
