-- Harden Supabase's public Data API exposure without breaking direct Prisma access.
--
-- Goal:
-- 1. Enable RLS on every table in the public schema so Security Advisor stops flagging them.
-- 2. Deny the public API roles (anon/authenticated/authenticator) by default.
-- 3. Keep direct PostgreSQL application roles (local Prisma, CI, production Prisma) working.
-- 4. Reduce the chance of regressions on future CREATE TABLE statements in the public schema.

create schema if not exists private;

do $$
declare
  api_roles text;
begin
  select string_agg(format('%I', rolname), ', ')
  into api_roles
  from pg_roles
  where rolname in ('anon', 'authenticated', 'authenticator');

  if api_roles is not null then
    execute format('revoke all on all tables in schema public from %s', api_roles);
    execute format('revoke all on all sequences in schema public from %s', api_roles);
    execute format('revoke all on all functions in schema public from %s', api_roles);

    execute format('alter default privileges in schema public revoke all on tables from %s', api_roles);
    execute format('alter default privileges in schema public revoke all on sequences from %s', api_roles);
    execute format('alter default privileges in schema public revoke all on functions from %s', api_roles);
  else
    raise notice 'Supabase API roles are not present in this database; skipping privilege revocations.';
  end if;
end
$$;

do $$
declare
  table_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'alter table %I.%I enable row level security',
      table_record.schemaname,
      table_record.tablename
    );

    if not exists (
      select 1
      from pg_policies
      where schemaname = table_record.schemaname
        and tablename = table_record.tablename
        and policyname = 'gestschool_backend_full_access'
    ) then
      execute format(
        'create policy gestschool_backend_full_access on %I.%I
          as permissive
          for all
          to public
          using (
            current_user <> ''anon''
            and current_user <> ''authenticated''
            and current_user <> ''authenticator''
          )
          with check (
            current_user <> ''anon''
            and current_user <> ''authenticated''
            and current_user <> ''authenticator''
          )',
        table_record.schemaname,
        table_record.tablename
      );
    end if;
  end loop;
end
$$;

create or replace function private.gestschool_secure_new_public_tables()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  command_record record;
  identifier_parts text[];
  table_name text;
  api_roles text;
begin
  select string_agg(format('%I', rolname), ', ')
  into api_roles
  from pg_roles
  where rolname in ('anon', 'authenticated', 'authenticator');

  for command_record in
    select *
    from pg_event_trigger_ddl_commands()
    where schema_name = 'public'
      and object_type in ('table', 'partitioned table')
  loop
    execute format(
      'alter table if exists %s enable row level security',
      command_record.object_identity
    );

    if api_roles is not null then
      execute format(
        'revoke all on table %s from %s',
        command_record.object_identity,
        api_roles
      );
    end if;

    identifier_parts := pg_catalog.parse_ident(command_record.object_identity, true);
    table_name := identifier_parts[array_length(identifier_parts, 1)];

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'gestschool_backend_full_access'
    ) then
      execute format(
        'create policy gestschool_backend_full_access on %s
          as permissive
          for all
          to public
          using (
            current_user <> ''anon''
            and current_user <> ''authenticated''
            and current_user <> ''authenticator''
          )
          with check (
            current_user <> ''anon''
            and current_user <> ''authenticated''
            and current_user <> ''authenticator''
          )',
        command_record.object_identity
      );
    end if;
  end loop;
end
$$;

do $$
begin
  begin
    if exists (
      select 1
      from pg_event_trigger
      where evtname = 'gestschool_secure_public_tables'
    ) then
      execute 'drop event trigger gestschool_secure_public_tables';
    end if;

    execute '
      create event trigger gestschool_secure_public_tables
      on ddl_command_end
      when tag in (''CREATE TABLE'', ''CREATE TABLE AS'', ''SELECT INTO'')
      execute function private.gestschool_secure_new_public_tables()
    ';
  exception
    when insufficient_privilege then
      raise notice 'Skipping event trigger creation because role % cannot create event triggers.', current_user;
  end;
end
$$;
