import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const org = "10000000-0000-0000-0000-000000000001",
  other = "10000000-0000-0000-0000-000000000002";
const manager = "20000000-0000-0000-0000-000000000001",
  employee = "20000000-0000-0000-0000-000000000002",
  outsider = "20000000-0000-0000-0000-000000000003";
const worker = "30000000-0000-0000-0000-000000000001",
  salary = "40000000-0000-0000-0000-000000000001";
test("PostgreSQL migrations, authorization, isolation and audit integrity", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`,
  );
  for (const migration of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + migration, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    `insert into auth.users(id,email) values('${manager}','manager@test.invalid'),('${employee}','employee@test.invalid'),('${outsider}','outsider@test.invalid');insert into public.organizations(id,name) values('${org}','Test'),('${other}','Other');insert into public.roles(organization_id,code,name,is_system) values('${org}','manager','Manager',true),('${org}','employee','Employee',true),('${other}','manager','Manager',true);insert into public.organization_members(organization_id,user_id) values('${org}','${manager}'),('${org}','${employee}'),('${other}','${outsider}');insert into public.member_roles select m.organization_id,m.id,r.id from public.organization_members m join public.roles r on r.organization_id=m.organization_id and r.code=case when m.user_id='${employee}' then 'employee' else 'manager' end;insert into public.role_permissions select organization_id,id,'rental.workers.read' from public.roles where organization_id='${org}' and code='employee';insert into public.rental_worker_statuses(organization_id,code,label) values('${org}','available','Available'),('${other}','available','Available');insert into public.rental_contract_statuses(organization_id,code,label) values('${org}','active','Active'),('${other}','active','Active');`,
  );
  const asUser = async (id, sql) => {
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
    );
    try {
      return await db.query(sql);
    } finally {
      await db.exec("reset role;");
    }
  };
  await t.test("website data is scoped and only published content is public", async () => {
    await asUser(manager, `insert into public.website_content(organization_id,headline,draft,published) values('${org}','Public title','{"headline":"Private draft"}',true)`);
    assert.equal((await asUser(employee, "select * from public.website_content")).rows.length, 0);
    assert.equal((await asUser(outsider, "select * from public.website_content")).rows.length, 0);
    await assert.rejects(() => asUser(employee, `insert into public.website_content(organization_id) values('${other}')`));
    await db.exec("set role anon");
    try {
      const publicRows = await db.query("select * from public.website_published_content");
      assert.equal(publicRows.rows[0].headline, "Public title");
      assert.equal(publicRows.rows[0].draft, undefined);
      await assert.rejects(() => db.query("select * from public.website_content"));
    } finally { await db.exec("reset role"); }
  });
  await t.test("website request follow-up requires website access and stays company scoped", async () => {
    await asUser(manager, `insert into public.website_requests(id,organization_id,customer_name,mobile,service) values('request-test','${org}','Test','12345678','التأجير')`);
    assert.equal((await asUser(employee, "select * from public.website_requests")).rows.length, 0);
    assert.equal((await asUser(outsider, "select * from public.website_requests")).rows.length, 0);
    assert.equal((await asUser(employee, "update public.website_requests set status='مكتمل' returning id")).rows.length, 0);
    assert.equal((await asUser(manager, "update public.website_requests set status='مكتمل',internal_notes='follow up' returning id")).rows.length, 1);
  });
  await t.test("public website submissions reach the company without exposing records", async () => {
    await db.exec("set role anon");
    try {
      const request = await db.query("select public.submit_website_request('Test','12345678','التأجير','Details') as id");
      assert.match(request.rows[0].id, /^REQ-/);
      const complaint = await db.query("select public.submit_website_complaint('12345678','Test complaint') as id");
      assert.match(complaint.rows[0].id, /^CMP-/);
      await assert.rejects(() => db.query("select * from public.website_requests"));
      await assert.rejects(() => db.query("select public.submit_website_request('x','1','wrong','')"));
    } finally { await db.exec("reset role"); }
    assert.equal((await asUser(manager, "select id from public.website_complaints")).rows.length, 1);
    assert.equal((await asUser(outsider, "select id from public.website_complaints")).rows.length, 0);
  });
  await t.test("public worker cards exclude private fields and unpublished workers", async () => {
    await asUser(manager, `insert into public.website_workers(organization_id,ref,name,nationality,profession,publication,cv_path,cv_file_name,passport_number,total_recruitment_cost) values('${org}','PUBLIC-1','Private name','Test','Worker','منشورة','private.pdf','private.pdf','SECRET',100),('${org}','DRAFT-1','Draft','Test','Worker','مسودة','','','',0)`);
    await db.exec("set role anon");
    try {
      const rows = (await db.query("select * from public.website_published_workers")).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].ref, "PUBLIC-1");
      for (const key of ["name", "passport_number", "cv_path", "total_recruitment_cost"]) assert.equal(rows[0][key], undefined);
      await assert.rejects(() => db.query("select * from public.website_workers"));
    } finally { await db.exec("reset role"); }
  });
  await t.test("company branding permits only scoped manager writes and limits members to branding fields", async () => {
    await asUser(manager, `insert into public.company_identity(organization_id,name_ar,phone) values('${org}','Test company','123')`);
    assert.equal((await asUser(employee, "select phone from public.company_identity")).rows.length, 0);
    const publicFields = (await asUser(employee, `select public.member_company_identity('${org}') as identity`)).rows[0].identity;
    assert.equal(publicFields.name_ar, "Test company");
    assert.equal(publicFields.phone, undefined);
    assert.equal((await asUser(outsider, "select name_ar from public.company_identity")).rows.length, 0);
    assert.equal((await asUser(employee, "update public.company_identity set name_ar='Blocked' returning name_ar")).rows.length, 0);
    await assert.rejects(() => asUser(manager, "update public.company_identity set primary_color='invalid'"));
    const path = `${org}/logo/${worker}.png`;
    await asUser(manager, `insert into storage.objects(bucket_id,name) values('company-branding','${path}')`);
    await assert.rejects(() => asUser(employee, `insert into storage.objects(bucket_id,name) values('company-branding','${path}')`));
    await assert.rejects(() => asUser(manager, `insert into storage.objects(bucket_id,name) values('company-branding','${other}/logo/${worker}.png')`));
    await asUser(manager, "update public.company_identity set name_ar='Updated'");
    assert.equal((await asUser(manager, "select * from public.audit_events where entity_type='company_identity' and action='update'")).rows.length, 1);
    await db.exec("set role anon");
    try {
      await assert.rejects(() => db.query("select name_ar from public.company_identity"));
      await assert.rejects(() => db.query(`select public.member_company_identity('${org}')`));
      await assert.rejects(() => db.query("select phone from public.company_identity"));
    } finally {
      await db.exec("reset role");
    }
  });
  await t.test(
    "manager can create records; actor cannot be spoofed",
    async () => {
      await asUser(
        manager,
        `insert into public.rental_workers(id,organization_id,name,nationality,availability_status_id,created_by) select '${worker}','${org}','Worker','Test',id,'${employee}' from public.rental_worker_statuses where organization_id='${org}' returning id`,
      );
      const r = await asUser(
        manager,
        `select created_by from public.rental_workers where id='${worker}'`,
      );
      assert.equal(r.rows[0].created_by, manager);
    },
  );
  await t.test(
    "employee read allowed, write and private data denied",
    async () => {
      assert.equal(
        (await asUser(employee, "select * from public.rental_workers")).rows
          .length,
        1,
      );
      await assert.rejects(() =>
        asUser(
          employee,
          `insert into public.rental_workers(organization_id,name,nationality,availability_status_id) select '${org}','No','Test',id from public.rental_worker_statuses where organization_id='${org}'`,
        ),
      );
      await asUser(
        manager,
        `insert into public.rental_worker_private(id,organization_id,iban) values('${worker}','${org}','PRIVATE')`,
      );
      assert.equal(
        (await asUser(employee, "select * from public.rental_worker_private"))
          .rows.length,
        0,
      );
    },
  );
  await t.test(
    "cross-organization reads and foreign keys blocked",
    async () => {
      assert.equal(
        (await asUser(outsider, "select * from public.rental_workers")).rows
          .length,
        0,
      );
      await assert.rejects(() =>
        asUser(
          outsider,
          `insert into public.rental_salary_records(organization_id,worker_id,period_label,due_date,amount) values('${other}','${worker}','Test','2026-11-03',100)`,
        ),
      );
    },
  );
  await t.test(
    "employees cannot elevate roles or edit evaluations even with forged permission",
    async () => {
      await assert.rejects(() =>
        asUser(
          employee,
          `select public.rental_save_role('${org}','employee','Employee',array['rental.access.write'])`,
        ),
      );
      await db.exec(
        `insert into public.role_permissions select organization_id,id,'rental.evaluations.write' from public.roles where code='employee' and organization_id='${org}';`,
      );
      await assert.rejects(() =>
        asUser(
          employee,
          `insert into public.rental_worker_evaluations(organization_id,worker_id,evaluation_date,assessment) values('${org}','${worker}','2026-11-03','Forged')`,
        ),
      );
    },
  );
  await t.test(
    "scope identifiers immutable; optimistic version advances",
    async () => {
      const r = await asUser(
        manager,
        `update public.rental_workers set name='Changed' where id='${worker}' and version=1 returning version`,
      );
      assert.equal(r.rows[0].version, 2);
      assert.equal(
        (
          await asUser(
            manager,
            `update public.rental_workers set name='Stale' where id='${worker}' and version=1 returning id`,
          )
        ).rows.length,
        0,
      );
      await assert.rejects(() =>
        asUser(
          manager,
          `update public.rental_workers set organization_id='${other}' where id='${worker}'`,
        ),
      );
    },
  );
  await t.test(
    "payments are exact, immutable and protected against retries",
    async () => {
      await asUser(
        manager,
        `insert into public.rental_salary_records(id,organization_id,worker_id,period_label,due_date,amount) values('${salary}','${org}','${worker}','Manual','2026-11-03',100.10)`,
      );
      const insert = `insert into public.rental_salary_payments(organization_id,salary_record_id,amount,payment_date,submission_id) values('${org}','${salary}',30.05,'2026-11-03','50000000-0000-0000-0000-000000000001')`;
      await asUser(manager, insert);
      await assert.rejects(() => asUser(manager, insert));
      await assert.rejects(() =>
        asUser(manager, "delete from public.rental_salary_payments"),
      );
      const sum = await asUser(
        manager,
        `select (s.amount-sum(p.amount))::text as balance from public.rental_salary_records s join public.rental_salary_payments p on p.salary_record_id=s.id group by s.id`,
      );
      assert.equal(sum.rows[0].balance, "70.05");
    },
  );
  await t.test(
    "storage requires matching metadata and organization permission",
    async () => {
      const doc = "60000000-0000-0000-0000-000000000001",
        path = `${org}/${worker}/${doc}/document`;
      await asUser(
        manager,
        `insert into public.rental_documents(id,organization_id,worker_id,category,object_path,original_filename,media_type,byte_size) values('${doc}','${org}','${worker}','cv','${path}','test.pdf','application/pdf',100)`,
      );
      await asUser(
        manager,
        `insert into storage.objects(bucket_id,name) values('rental-documents','${path}')`,
      );
      assert.equal(
        (await asUser(employee, "select * from storage.objects where bucket_id='rental-documents'")).rows.length,
        0,
      );
      assert.equal(
        (await asUser(outsider, "select * from storage.objects where bucket_id='rental-documents'")).rows.length,
        0,
      );
      await assert.rejects(() =>
        asUser(
          manager,
          `insert into storage.objects(bucket_id,name) values('rental-documents','${org}/${worker}/missing/document')`,
        ),
      );
    },
  );
  await t.test("revoked members lose data access immediately", async () => {
    await db.exec(
      `update public.organization_members set is_active=false where user_id='${employee}'`,
    );
    assert.equal(
      (await asUser(employee, "select * from public.rental_workers")).rows
        .length,
      0,
    );
  });
  await t.test(
    "anonymous has no table access and audit cannot be forged",
    async () => {
      await db.exec("set role anon;");
      try {
        await assert.rejects(() =>
          db.query("select * from public.rental_workers"),
        );
      } finally {
        await db.exec("reset role;");
      }
      await assert.rejects(() =>
        asUser(
          manager,
          `insert into public.audit_events(organization_id,action,entity_type) values('${org}','spoof','test')`,
        ),
      );
      assert.ok(
        (await asUser(manager, "select * from public.audit_events")).rows
          .length >= 5,
      );
    },
  );
  await t.test(
    "manager can administer roles; reserved privileges stay protected",
    async () => {
      const result = await asUser(
        manager,
        `select public.rental_save_role('${org}','qa_role','QA role',array['rental.workers.read']) as id`,
      );
      assert.ok(result.rows[0].id);
      await assert.rejects(() =>
        asUser(
          manager,
          `select public.rental_save_role('${org}','qa_role','QA role',array['rental.evaluations.write'])`,
        ),
      );
      await assert.rejects(() =>
        asUser(
          employee,
          `select * from public.rental_member_directory('${org}')`,
        ),
      );
      assert.equal(
        (
          await asUser(
            manager,
            `select * from public.rental_member_directory('${org}')`,
          )
        ).rows.length,
        2,
      );
    },
  );
  await t.test("only published login branding is public and only its manager can change it", async () => {
    const insert = `insert into public.login_branding(organization_id,name_ar,primary_color,secondary_color)
      values('${org}','Example','#123456','#abcdef')`;
    await assert.rejects(() => asUser(employee, insert));
    await assert.rejects(() => asUser(outsider, insert));
    await asUser(manager, insert);
    const asVisitor = async (sql) => {
      await db.exec("set role anon");
      try { return await db.query(sql); } finally { await db.exec("reset role"); }
    };
    const read = "select name_ar,primary_color,logo_png from public.login_branding";
    assert.equal((await asVisitor(read)).rows.length, 0);
    await assert.rejects(() => asUser(manager, "update public.login_branding set logo_png='https://example.invalid/x.svg'"));
    await asUser(manager, "update public.login_branding set published=true");
    assert.equal((await asVisitor(read)).rows[0].name_ar, "Example");
    await assert.rejects(() => asVisitor("select organization_id from public.login_branding"));
    await assert.rejects(() => asVisitor("select phone from public.company_identity"));
    await asUser(manager, "update public.login_branding set published=false");
    assert.equal((await asVisitor(read)).rows.length, 0);
  });
  await t.test("operational records enforce company scope, stay integrity and leave approval", async () => {
    const stay = `insert into public.operations_housing(organization_id,worker_id,location,reason,entered_on)
      values('${org}','${worker}','Building A','available','2026-11-06')`;
    await assert.rejects(() => asUser(employee, stay));
    await asUser(manager, stay);
    await assert.rejects(() => asUser(manager, stay));
    await assert.rejects(() => asUser(outsider, stay.replace(org, other)));
    await asUser(manager, "update public.operations_housing set left_on='2026-11-07'");
    await asUser(manager, stay.replace("2026-11-06", "2026-11-08"));
    assert.equal((await asUser(outsider, "select id from public.operations_housing")).rows.length, 0);
    const staff = (await asUser(manager, `insert into public.operations_employees
      (organization_id,name,job_title,department,hired_on,status)
      values('${org}','QA employee','Coordinator','Operations','2026-11-06','active') returning id`)).rows[0].id;
    const leave = `insert into public.operations_leaves(organization_id,employee_id,leave_type,start_on,end_on,status)
      values('${org}','${staff}','Annual','2026-11-09','2026-11-10','pending') returning id`;
    const id = (await asUser(manager, leave)).rows[0].id;
    await asUser(manager, `update public.operations_leaves set status='approved' where id='${id}'`);
    assert.equal((await asUser(manager, `select status from public.operations_leaves where id='${id}'`)).rows[0].status, "approved");
    await assert.rejects(() => asUser(manager, "delete from public.operations_housing"));
  });
  await t.test("recruitment import is atomic, permission scoped and version checked", async () => {
    const row = (n) => ({ contract_number: n, employer_name: "QA client", worker_name: "QA worker",
      passport_number: "0009", stage: "visa", opened_on: "2026-10-01", duration_days: 90, contract_state: "active",
      housing_transferred: false, trial: false, client_rights: false });
    const save = (user, scope, items) => asUser(user,
      `select public.save_recruitment_batch('${scope}', '${JSON.stringify(items)}'::jsonb) as count`);
    await assert.rejects(() => save(employee, org, [{ data: row("1001") }]));
    await assert.rejects(() => save(manager, other, [{ data: row("1001") }]));
    await assert.rejects(() => save(manager, org, [{ data: row("1001") }, { data: row("۱۰۰۱") }]));
    const records = () => asUser(manager, "select id, version, contract_number, arrived_on, stage, duration_days from public.operations_recruitment order by contract_number");
    assert.equal((await records()).rows.length, 0);
    assert.equal((await save(manager, org, [{ data: row("1001") }])).rows[0].count, 1);
    const [saved] = (await records()).rows;
    const edit = { id: saved.id, version: saved.version, data: { ...row("1001"), stage: "paperwork_fingerprint_done", arrived_on: "2026-11-05" } };
    await save(manager, org, [edit]);
    await assert.rejects(() => save(manager, org, [{ data: row("1002") }, edit]));
    const current = (await records()).rows;
    assert.equal(current.length, 1);
    assert.equal(current[0].version, saved.version + 1);
    assert.ok(current[0].arrived_on);
    assert.equal(current[0].stage, "paperwork_fingerprint_done");
    assert.equal(current[0].duration_days, 90);
    assert.equal((await asUser(outsider, "select id from public.operations_recruitment")).rows.length, 0);
  });
  await db.close();
});
