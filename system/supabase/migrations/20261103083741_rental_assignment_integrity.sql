begin;
create function private.check_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='rental_contracts' then
  if tg_op='INSERT' or new.status_id is distinct from old.status_id then
   if not exists(select 1 from public.rental_contract_statuses where id=new.status_id and organization_id=new.organization_id and is_active) then raise exception 'Contract status is not available';end if;
  end if;
 elsif tg_table_name='rental_workers' then
  if tg_op='INSERT' or new.availability_status_id is distinct from old.availability_status_id then
   if not exists(select 1 from public.rental_worker_statuses where id=new.availability_status_id and organization_id=new.organization_id and is_active) then raise exception 'Worker status is not available';end if;
  end if;
 elsif tg_table_name='rental_worker_evaluations' and new.contract_id is not null then
  if not exists(select 1 from public.rental_contracts where id=new.contract_id and organization_id=new.organization_id and worker_id=new.worker_id) then raise exception 'Evaluation contract must belong to the worker';end if;
 end if;
 return new;
end $$;
revoke all on function private.check_assignment() from public,anon,authenticated;
create trigger check_assignment before insert or update on public.rental_workers for each row execute function private.check_assignment();
create trigger check_assignment before insert or update on public.rental_contracts for each row execute function private.check_assignment();
create trigger check_assignment before insert or update on public.rental_worker_evaluations for each row execute function private.check_assignment();
commit;
