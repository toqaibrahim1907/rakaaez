begin;

create table public.operations_recruitment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version int not null default 1,
  contract_number text not null check (length(btrim(contract_number)) between 1 and 100),
  client_id uuid not null,
  worker_id uuid,
  stage text not null check (stage in ('request','visa','cv','screening','travel','arrival','handover','completed','cancelled')),
  opened_on date not null,
  expected_on date,
  notes text check (length(notes)<=4000),
  unique (organization_id, contract_number),
  foreign key (organization_id,client_id) references public.rental_clients(organization_id,id),
  foreign key (organization_id,worker_id) references public.rental_workers(organization_id,id)
);

create table public.operations_housing (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version int not null default 1,
  worker_id uuid not null,
  location text not null check (length(btrim(location)) between 1 and 200),
  reason text not null check (reason in ('available','travel','transfer','other')),
  entered_on date not null,
  left_on date check (left_on >= entered_on),
  notes text check (length(notes)<=4000),
  foreign key (organization_id,worker_id) references public.rental_workers(organization_id,id)
);

create table public.operations_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version int not null default 1,
  name text not null check (length(btrim(name)) between 1 and 200),
  job_title text not null check (length(btrim(job_title)) between 1 and 200),
  department text not null check (length(btrim(department)) between 1 and 200),
  hired_on date not null,
  status text not null check (status in ('active','inactive')),
  notes text check (length(notes)<=4000),
  unique (organization_id,id)
);

create table public.operations_leaves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version int not null default 1,
  employee_id uuid not null,
  leave_type text not null check (length(btrim(leave_type)) between 1 and 200),
  start_on date not null,
  end_on date not null check (end_on >= start_on),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes text check (length(notes)<=4000),
  foreign key (organization_id,employee_id) references public.operations_employees(organization_id,id)
);

create table public.operations_complaints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version int not null default 1,
  client_id uuid not null,
  subject text not null check (length(btrim(subject)) between 1 and 200),
  received_on date not null,
  status text not null check (status in ('new','working','resolved','closed')),
  notes text check (length(notes)<=4000),
  foreign key (organization_id,client_id) references public.rental_clients(organization_id,id)
);

create table public.operations_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  version int not null default 1,
  client_id uuid not null,
  service text not null check (service in ('rental','recruitment','other')),
  received_on date not null,
  status text not null check (status in ('new','working','completed','cancelled')),
  notes text check (length(notes)<=4000),
  foreign key (organization_id,client_id) references public.rental_clients(organization_id,id)
);

create unique index operations_housing_one_open_stay
on public.operations_housing(organization_id,worker_id) where left_on is null;

create function private.check_leave_decision() returns trigger
language plpgsql set search_path='' as $$
begin
  if not private.is_manager(new.organization_id) then
    if (tg_op = 'INSERT' and new.status <> 'pending')
       or (tg_op = 'UPDATE' and (old.status <> 'pending' or new.status <> 'pending')) then
      raise exception 'Only managers can decide leave requests' using errcode='42501';
    end if;
  end if;
  return new;
end
$$;
revoke all on function private.check_leave_decision() from public,anon,authenticated;
create trigger operations_leave_decision before insert or update on public.operations_leaves
for each row execute function private.check_leave_decision();

do $$
declare
  area text;
  tab text;
begin
  foreach area in array array['recruitment','housing','employees','leaves','complaints','requests'] loop
    tab := 'operations_' || area;
    insert into public.permissions(code,module,description) values
      ('rental.'||area||'.read','operations','Read '||area),
      ('rental.'||area||'.write','operations','Manage '||area);
    execute format('alter table public.%I enable row level security', tab);
    execute format('revoke all on public.%I from public,anon,authenticated', tab);
    execute format('grant select, insert, update on public.%I to authenticated', tab);
    execute format('create policy operation_read on public.%I for select to authenticated using (private.has_permission(organization_id,%L))',tab,'rental.'||area||'.read');
    execute format('create policy operation_insert on public.%I for insert to authenticated with check (private.has_permission(organization_id,%L))',tab,'rental.'||area||'.write');
    execute format('create policy operation_update on public.%I for update to authenticated using (private.has_permission(organization_id,%L)) with check (private.has_permission(organization_id,%L))',tab,'rental.'||area||'.write','rental.'||area||'.write');
    execute format('create index on public.%I(organization_id,id)',tab);
    execute format('create trigger stamp before insert or update on public.%I for each row execute function private.stamp_record()',tab);
    execute format('create trigger audit after insert or update on public.%I for each row execute function private.audit_change()',tab);
  end loop;
end
$$;
commit;
