create or replace function public.submit_website_request(p_name text,p_mobile text,p_service text,p_notes text default '') returns text language plpgsql security definer set search_path='' as $$
declare org uuid; result_id text; phone_key text;
begin
 if length(trim(coalesce(p_name,''))) not between 2 and 100 or length(trim(coalesce(p_mobile,''))) not between 8 and 20 or p_service not in ('التأجير','الاستقدام') or length(coalesce(p_notes,'')) > 1000 then raise exception 'Invalid request' using errcode='22023'; end if;
 phone_key := regexp_replace(p_mobile,'[^0-9]','','g');
 if length(phone_key) not between 8 and 20 then raise exception 'Invalid phone' using errcode='22023'; end if;
 if (select count(*) from public.website_content where published) <> 1 then raise exception 'Website unavailable' using errcode='55000'; end if;
 select organization_id into org from public.website_content where published limit 1;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if (select count(*) from public.website_requests where organization_id=org and created_at > now()-interval '10 minutes' and regexp_replace(mobile,'[^0-9]','','g')=phone_key) + (select count(*) from public.website_complaints where organization_id=org and created_at > now()-interval '10 minutes' and regexp_replace(phone,'[^0-9]','','g')=phone_key) >= 3 or (select count(*) from public.website_requests where organization_id=org and created_at > now()-interval '1 hour') + (select count(*) from public.website_complaints where organization_id=org and created_at > now()-interval '1 hour') >= 100 then raise exception 'Submission limit reached' using errcode='53300'; end if;
 result_id := 'REQ-' || replace(gen_random_uuid()::text,'-','');
 insert into public.website_requests(id,organization_id,customer_name,mobile,service,notes) values (result_id,org,trim(p_name),trim(p_mobile),p_service,coalesce(p_notes,''));
 return result_id;
end $$;
create or replace function public.submit_website_complaint(p_phone text,p_text text) returns text language plpgsql security definer set search_path='' as $$
declare org uuid; result_id text; phone_key text;
begin
 if length(trim(coalesce(p_phone,''))) not between 8 and 20 or length(trim(coalesce(p_text,''))) not between 8 and 3000 then raise exception 'Invalid complaint' using errcode='22023'; end if;
 phone_key := regexp_replace(p_phone,'[^0-9]','','g');
 if length(phone_key) not between 8 and 20 then raise exception 'Invalid phone' using errcode='22023'; end if;
 if (select count(*) from public.website_content where published) <> 1 then raise exception 'Website unavailable' using errcode='55000'; end if;
 select organization_id into org from public.website_content where published limit 1;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if (select count(*) from public.website_requests where organization_id=org and created_at > now()-interval '10 minutes' and regexp_replace(mobile,'[^0-9]','','g')=phone_key) + (select count(*) from public.website_complaints where organization_id=org and created_at > now()-interval '10 minutes' and regexp_replace(phone,'[^0-9]','','g')=phone_key) >= 3 or (select count(*) from public.website_requests where organization_id=org and created_at > now()-interval '1 hour') + (select count(*) from public.website_complaints where organization_id=org and created_at > now()-interval '1 hour') >= 100 then raise exception 'Submission limit reached' using errcode='53300'; end if;
 result_id := 'CMP-' || replace(gen_random_uuid()::text,'-','');
 insert into public.website_complaints(id,organization_id,phone,complaint_text) values (result_id,org,trim(p_phone),trim(p_text));
 return result_id;
end $$;

