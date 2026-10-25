-- Security Phase 2 — read-only catalog inventory. Run on the ISOLATED staging project only
-- (esqnyktumxscyvznftlc). Nothing here writes. Paste each result into
-- docs/security/phase-2-database-inventory.md (section "Live catalog").

-- 0. Identity check: confirm which database this is before reading anything else.
select current_database(), current_user, inet_server_addr(), now();

-- 1. Every table/view/materialized view in application schemas, with RLS state.
select n.nspname as schema, c.relname as name,
       case c.relkind when 'r' then 'table' when 'p' then 'partitioned' when 'v' then 'view' when 'm' then 'matview' end as kind,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       (select count(*) from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p', 'v', 'm')
  and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast', 'auth', 'extensions', 'graphql', 'graphql_public',
                        'net', 'pgsodium', 'pgsodium_masks', 'realtime', 'supabase_functions', 'supabase_migrations', 'vault', 'cron')
order by 1, 2;

-- 2. Every policy, verbatim.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by 1, 2, 3;

-- 3. Table privileges held by anon / authenticated (RLS is the row control; grants are the outer gate).
select table_schema, table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where grantee in ('anon', 'authenticated') and table_schema in ('public', 'storage')
group by 1, 2, 3
order by 1, 2, 3;

-- 4. Views: security_invoker off means the view runs as its owner and can bypass RLS on base tables.
select n.nspname, c.relname, coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') as security_invoker
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('v', 'm') and n.nspname = 'public';

-- 5. Functions: SECURITY DEFINER, search_path, and who can EXECUTE.
select p.oid::regprocedure as function, p.prosecdef as security_definer, p.proconfig as config,
       pg_get_userbyid(p.proowner) as owner,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec,
       p.prorettype::regtype as returns
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.prosecdef desc, 1;

-- 6. Triggers on application tables.
select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public'
order by 1, 2;

-- 7. Columns that look like ownership / tenancy, per table (drift check against the code).
select table_name, string_agg(column_name || ':' || data_type || case when is_nullable = 'YES' then '?' else '' end, ', ' order by ordinal_position) as owner_columns
from information_schema.columns
where table_schema = 'public'
  and column_name in ('user_id', 'owner_id', 'admin_user_id', 'admin_email', 'school_id', 'school_account_id', 'teacher_id', 'created_by', 'email', 'role', 'department')
group by 1
order by 1;

-- 8. Foreign keys to auth.users and between tenant tables.
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f' and connamespace = 'public'::regnamespace
order by 1;

-- 9. Storage buckets and object policies.
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
select policyname, roles, cmd, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects';
select bucket_id, count(*) as objects from storage.objects group by 1 order by 1;

-- 10. Default privileges that hand new public functions/tables to anon/authenticated.
select pg_get_userbyid(defaclrole) as owner, defaclnamespace::regnamespace as schema, defaclobjtype as type, defaclacl
from pg_default_acl
where defaclnamespace = 'public'::regnamespace;
