begin;
create table public.rental_worker_statuses (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 code text not null,label text not null check(length(trim(label)) between 1 and 80),sort_order int not null default 0,is_active boolean not null default true,
 unique(organization_id,code),unique(organization_id,id)
);
create table public.rental_contract_statuses (like public.rental_worker_statuses including all);
alter table public.rental_contract_statuses add foreign key(organization_id) references public.organizations(id);
create table public.rental_workers (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name)) between 1 and 200),nationality text not null check(length(trim(nationality)) between 1 and 100),
 arrival_date date,gender text,religion text,age int check(age>=0),occupation text,experience text,
 availability_status_id uuid not null,notes text,archived_at timestamptz,archive_reason text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id),version int not null default 1,
 unique(organization_id,id),foreign key(organization_id,availability_status_id) references public.rental_worker_statuses(organization_id,id)
);
create table public.rental_worker_private (
 id uuid primary key,organization_id uuid not null references public.organizations(id),
 residency_number text,passport_number text,border_number text,phone text,iban text,insurance_expiry date,
 reference_salary numeric(14,2) check(reference_salary>=0),recruitment_cost numeric(14,2) check(recruitment_cost>=0),currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id),version int not null default 1,
 unique(organization_id,id),foreign key(organization_id,id) references public.rental_workers(organization_id,id) on delete cascade
);
create table public.rental_clients (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null check(length(trim(name)) between 1 and 200),city text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id),version int not null default 1,unique(organization_id,id)
);
create table public.rental_client_private (
 id uuid primary key,organization_id uuid not null references public.organizations(id),phone text,identity_number text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id),version int not null default 1,
 unique(organization_id,id),foreign key(organization_id,id) references public.rental_clients(organization_id,id) on delete cascade
);
create table public.rental_contracts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),contract_number text not null check(length(trim(contract_number)) between 1 and 100),
 client_id uuid not null,worker_id uuid not null,start_date date not null,end_date date not null,package_days int check(package_days>=0),amount numeric(14,2) not null check(amount>=0),currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),status_id uuid not null,notes text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id),version int not null default 1,
 check(end_date>=start_date),unique(organization_id,id),unique(organization_id,contract_number),
 foreign key(organization_id,client_id) references public.rental_clients(organization_id,id),foreign key(organization_id,worker_id) references public.rental_workers(organization_id,id),foreign key(organization_id,status_id) references public.rental_contract_statuses(organization_id,id)
);
create table public.rental_salary_records (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),worker_id uuid not null,
 period_label text not null check(length(trim(period_label)) between 1 and 200),period_start date,period_end date,due_date date not null,
 amount numeric(14,2) not null check(amount>=0),currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),administrative_state text not null default 'open' check(administrative_state in ('open','stopped')),notes text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id),version int not null default 1,
 unique(organization_id,id),unique(organization_id,id,currency),foreign key(organization_id,worker_id) references public.rental_workers(organization_id,id)
);
create table public.rental_salary_payments (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),salary_record_id uuid not null,
 amount numeric(14,2) not null check(amount>0),currency text not null default 'SAR',payment_date date not null,reference text,
 recorded_by uuid references auth.users(id),created_at timestamptz not null default now(),submission_id uuid not null,
 unique(organization_id,submission_id),foreign key(organization_id,salary_record_id,currency) references public.rental_salary_records(organization_id,id,currency)
);
create table public.rental_worker_evaluations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),worker_id uuid not null,contract_id uuid,
 evaluation_date date not null,assessment text not null check(length(trim(assessment)) between 1 and 500),work_days int check(work_days>=0),notes text,evaluator_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id),version int not null default 1,
 unique(organization_id,id),foreign key(organization_id,worker_id) references public.rental_workers(organization_id,id),foreign key(organization_id,contract_id) references public.rental_contracts(organization_id,id)
);
create table public.rental_documents (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),worker_id uuid not null,category text not null check(category in ('cv','residency')),
 bucket_id text not null default 'rental-documents' check(bucket_id='rental-documents'),object_path text not null unique,
 original_filename text not null check(length(original_filename) between 1 and 200),media_type text not null check(media_type in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 byte_size int not null check(byte_size between 1 and 10485760),previous_document_id uuid,uploaded_by uuid references auth.users(id),created_at timestamptz not null default now(),
 unique(organization_id,id),foreign key(organization_id,worker_id) references public.rental_workers(organization_id,id),foreign key(organization_id,previous_document_id) references public.rental_documents(organization_id,id),
 check(object_path=organization_id::text||'/'||worker_id::text||'/'||id::text||'/document')
);
create table public.rental_settings (
 organization_id uuid primary key references public.organizations(id),soon_days int not null default 7 check(soon_days between 0 and 365),salary_mode text not null default 'manual' check(salary_mode='manual'),salary_policy_notes text,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id),version int not null default 1
);
create table public.rental_import_mappings (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),source_system text not null,source_entity text not null,source_id text not null,target_entity text not null,target_id uuid not null,imported_at timestamptz not null default now(),
 unique(organization_id,source_system,source_entity,source_id)
);
create index worker_org on public.rental_workers(organization_id,availability_status_id);
create index worker_private_org on public.rental_worker_private(organization_id);
create index client_org on public.rental_clients(organization_id);
create index client_private_org on public.rental_client_private(organization_id);
create index contract_org_dates on public.rental_contracts(organization_id,end_date,status_id);
create index contract_worker on public.rental_contracts(organization_id,worker_id);
create index salary_org_due on public.rental_salary_records(organization_id,due_date);
create index payments_salary on public.rental_salary_payments(organization_id,salary_record_id);
create index evaluation_worker on public.rental_worker_evaluations(organization_id,worker_id,evaluation_date);
create index document_worker on public.rental_documents(organization_id,worker_id);

create function private.stamp_record() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.organization_id<>old.organization_id or new.id<>old.id then raise exception 'Record scope is immutable'; end if;
  new.created_at=old.created_at;new.created_by=old.created_by;new.version=old.version+1;
 else new.created_at=now();new.created_by=auth.uid();new.version=1;
 end if;
 new.updated_at=now();new.updated_by=auth.uid();
 if tg_table_name='rental_worker_evaluations' then new.evaluator_id=auth.uid();end if;
 return new;
end $$;
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_json jsonb;
begin
 if tg_op='DELETE' then row_json=to_jsonb(old);else row_json=to_jsonb(new);end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id) values((row_json->>'organization_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,(row_json->>'id')::uuid);
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create function private.stamp_payment() returns trigger language plpgsql set search_path='' as $$
begin new.recorded_by=auth.uid();new.created_at=now();return new;end $$;
create function private.stamp_document() returns trigger language plpgsql set search_path='' as $$
begin new.uploaded_by=auth.uid();new.created_at=now();return new;end $$;
create function private.stamp_settings() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then if new.organization_id<>old.organization_id then raise exception 'Record scope is immutable';end if;new.version=old.version+1;else new.version=1;end if;
 new.updated_by=auth.uid();new.updated_at=now();return new;
end $$;
revoke all on function private.stamp_record(),private.audit_change(),private.stamp_payment(),private.stamp_document(),private.stamp_settings() from public,anon,authenticated;

do $$
declare item record; write_check text;
begin
 for item in select * from (values
 ('rental_workers','workers'),('rental_worker_private','workers_private'),('rental_clients','clients'),('rental_client_private','clients_private'),('rental_contracts','contracts'),('rental_salary_records','salaries'),('rental_worker_evaluations','evaluations')
 ) as t(tbl,area) loop
  execute format('alter table public.%I enable row level security',item.tbl);
  execute format('revoke all on public.%I from anon,authenticated',item.tbl);
  execute format('grant select,insert,update,delete on public.%I to authenticated',item.tbl);
  execute format('create policy read_record on public.%I for select to authenticated using(private.has_permission(organization_id,%L))',item.tbl,'rental.'||item.area||'.read');
  write_check=case when item.area='evaluations' then 'private.is_manager(organization_id)' else format('private.has_permission(organization_id,%L)','rental.'||item.area||'.write') end;
  execute format('create policy insert_record on public.%I for insert to authenticated with check(%s)',item.tbl,write_check);
  execute format('create policy update_record on public.%I for update to authenticated using(%s) with check(%s)',item.tbl,write_check,write_check);
  execute format('create policy delete_record on public.%I for delete to authenticated using(%s)',item.tbl,write_check);
  execute format('create trigger stamp_record before insert or update on public.%I for each row execute function private.stamp_record()',item.tbl);
  execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',item.tbl);
 end loop;
 for item in select unnest(array['rental_worker_statuses','rental_contract_statuses','rental_settings','rental_documents','rental_salary_payments','rental_import_mappings']) tbl loop
  execute format('alter table public.%I enable row level security',item.tbl);
  execute format('revoke all on public.%I from anon,authenticated',item.tbl);
 end loop;
 for item in select unnest(array['rental_worker_statuses','rental_contract_statuses','rental_settings']) tbl loop
  execute format('grant select,insert,update on public.%I to authenticated',item.tbl);
  execute format('create policy read_catalog on public.%I for select to authenticated using(private.is_member(organization_id))',item.tbl);
  execute format('create policy insert_catalog on public.%I for insert to authenticated with check(private.has_permission(organization_id,''rental.settings.write''))',item.tbl);
  execute format('create policy update_catalog on public.%I for update to authenticated using(private.has_permission(organization_id,''rental.settings.write'')) with check(private.has_permission(organization_id,''rental.settings.write''))',item.tbl);
 end loop;
end $$;
grant select,insert on public.rental_salary_payments to authenticated;
create policy read_payment on public.rental_salary_payments for select to authenticated using(private.has_permission(organization_id,'rental.salaries.read'));
create policy insert_payment on public.rental_salary_payments for insert to authenticated with check(private.has_permission(organization_id,'rental.salaries.write'));
create trigger stamp_payment before insert on public.rental_salary_payments for each row execute function private.stamp_payment();
create trigger audit_payment after insert on public.rental_salary_payments for each row execute function private.audit_change();
grant select,insert,delete on public.rental_documents to authenticated;
create policy read_document on public.rental_documents for select to authenticated using(private.has_permission(organization_id,'rental.documents.read'));
create policy insert_document on public.rental_documents for insert to authenticated with check(private.has_permission(organization_id,'rental.documents.write'));
create policy delete_document on public.rental_documents for delete to authenticated using(private.has_permission(organization_id,'rental.documents.write'));
create trigger stamp_document before insert on public.rental_documents for each row execute function private.stamp_document();
create trigger audit_document after insert or delete on public.rental_documents for each row execute function private.audit_change();
create trigger stamp_settings before insert or update on public.rental_settings for each row execute function private.stamp_settings();
grant select,insert on public.rental_import_mappings to authenticated;
create policy import_read on public.rental_import_mappings for select to authenticated using(private.has_permission(organization_id,'rental.import.write'));
create policy import_insert on public.rental_import_mappings for insert to authenticated with check(private.has_permission(organization_id,'rental.import.write'));

create function private.guard_catalog() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.organization_id<>old.organization_id or new.code<>old.code then raise exception 'Catalog identity is immutable';end if;return new;
end $$;
revoke all on function private.guard_catalog() from public,anon,authenticated;
create trigger catalog_guard before update on public.rental_worker_statuses for each row execute function private.guard_catalog();
create trigger catalog_guard before update on public.rental_contract_statuses for each row execute function private.guard_catalog();
create trigger catalog_audit after insert or update on public.rental_worker_statuses for each row execute function private.audit_change();
create trigger catalog_audit after insert or update on public.rental_contract_statuses for each row execute function private.audit_change();
create trigger settings_audit after insert or update on public.rental_settings for each row execute function private.audit_change();
commit;
