create table public.website_workers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 ref text not null unique, name text not null default '', service text not null default 'الاستقدام',
 nationality text not null default '', profession text not null default 'عاملة منزلية', age text not null default '',
 experience text not null default '', languages text not null default '', skills text not null default '',
 availability text not null default 'متاحة', publication text not null default 'مسودة',
 cv_path text not null, cv_file_name text not null, extracted boolean not null default false,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 photo_path text, total_recruitment_cost numeric(12,2), salary text not null default '', religion text not null default '',
 passport_number text not null default '', nationality_raw text not null default '', religion_raw text not null default '',
 job_raw text not null default '', salary_raw text not null default '', age_raw text not null default '',
 experience_raw text not null default '', passport_number_raw text not null default '', salary_value numeric(12,2),
 age_value integer, experience_value numeric(5,2)
);
create table public.website_requests (
 id text primary key, organization_id uuid not null references public.organizations(id),
 customer_name text not null, mobile text not null, service text not null, nationality text not null default '',
 profession text not null default '', notes text not null default '', status text not null default 'لم يتم التواصل',
 assignee uuid references auth.users(id), internal_notes text not null default '', worker_ref text references public.website_workers(ref) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.website_complaints (
 id text primary key, organization_id uuid not null references public.organizations(id),
 phone text not null, complaint_text text not null, status text not null default 'جديدة',
 source text not null default 'chatbot', assignee uuid references auth.users(id), internal_notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.website_workers enable row level security;
alter table public.website_requests enable row level security;
alter table public.website_complaints enable row level security;
revoke all on public.website_workers,public.website_requests,public.website_complaints from anon,authenticated;

