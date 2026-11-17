begin;

alter table public.operations_recruitment
  alter column client_id drop not null,
  add column employer_name text,
  add column employer_identity text,
  add column visa_number text,
  add column occupation text,
  add column nationality text,
  add column worker_name text,
  add column passport_number text,
  add column employee_name text,
  add column arrival_city text,
  add column contract_state text not null default 'active' check (contract_state in ('active','completed','cancelled')),
  add column duration_days integer check (duration_days between 1 and 3650),
  add column visa_issued boolean,
  add column ticket_on date,
  add column arrived_on date,
  add column archived_at timestamptz,
  add column archive_reason text,
  add column housing_transferred boolean not null default false,
  add column trial boolean not null default false,
  add column client_rights boolean not null default false,
  add constraint recruitment_employer_present check (client_id is not null or nullif(btrim(employer_name),'') is not null),
  add constraint recruitment_contract_number_valid check (char_length(btrim(contract_number)) between 1 and 100),
  add constraint recruitment_arrival_order check (arrived_on is null or arrived_on >= opened_on);

update public.operations_recruitment
set contract_state = stage
where stage in ('completed','cancelled');

create unique index recruitment_contract_number_normalized
on public.operations_recruitment (
  organization_id,
  lower(translate(btrim(contract_number), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'))
);

-- A batch is one transaction. Existing rows must match the version reviewed by the operator.
create function public.save_recruitment_batch(p_org uuid, p_rows jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  entry public.operations_recruitment;
  affected integer;
  total integer := 0;
begin
  if not private.has_permission(p_org, 'rental.recruitment.write') then
    raise exception 'Recruitment write permission required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    raise exception 'Expected 1 to 2000 recruitment rows';
  end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    entry := jsonb_populate_record(null::public.operations_recruitment, item->'data');
    if item->>'id' is null then
      if nullif(btrim(entry.worker_name), '') is null or nullif(btrim(entry.passport_number), '') is null then
        raise exception 'Worker name and passport are required for new recruitment contracts' using errcode = '23514';
      end if;
      insert into public.operations_recruitment (organization_id, contract_number, employer_name, employer_identity, visa_number, occupation, nationality, worker_name, passport_number, employee_name, arrival_city, contract_state, duration_days, visa_issued, ticket_on, arrived_on, archived_at, archive_reason, housing_transferred, trial, client_rights, stage, opened_on, expected_on, notes)
      values (p_org, entry.contract_number, entry.employer_name, entry.employer_identity, entry.visa_number, entry.occupation, entry.nationality, entry.worker_name, entry.passport_number, entry.employee_name, entry.arrival_city, entry.contract_state, entry.duration_days, entry.visa_issued, entry.ticket_on, entry.arrived_on, entry.archived_at, entry.archive_reason, entry.housing_transferred, entry.trial, entry.client_rights, entry.stage, entry.opened_on, entry.expected_on, entry.notes);
    else
      update public.operations_recruitment set
        employer_name = entry.employer_name,
        employer_identity = entry.employer_identity,
        visa_number = entry.visa_number,
        occupation = entry.occupation,
        nationality = entry.nationality,
        worker_name = entry.worker_name,
        passport_number = entry.passport_number,
        employee_name = entry.employee_name,
        arrival_city = entry.arrival_city,
        contract_state = entry.contract_state,
        duration_days = entry.duration_days,
        visa_issued = entry.visa_issued,
        ticket_on = entry.ticket_on,
        arrived_on = entry.arrived_on,
        archived_at = entry.archived_at,
        archive_reason = entry.archive_reason,
        housing_transferred = entry.housing_transferred,
        trial = entry.trial,
        client_rights = entry.client_rights,
        stage = entry.stage,
        opened_on = entry.opened_on,
        expected_on = entry.expected_on,
        notes = entry.notes
      where organization_id = p_org and id = (item->>'id')::uuid
        and version = (item->>'version')::int;
      get diagnostics affected = row_count;
      if affected <> 1 then
        raise exception 'Recruitment record changed after review' using errcode = '40001';
      end if;
    end if;
    total := total + 1;
  end loop;
  return total;
end
$$;
revoke all on function public.save_recruitment_batch(uuid,jsonb) from public,anon;
grant execute on function public.save_recruitment_batch(uuid,jsonb) to authenticated;

commit;
