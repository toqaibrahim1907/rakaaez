import { client } from "../supabase-client.js";
import { models } from "./model.js";
import { has } from "../permissions.js";
export async function checked(result) {
  const { data, error } = await result;
  if (error) throw error;
  return data;
}
export async function rpc(name, args = {}) {
  return checked(client.rpc(name, args));
}
export async function rows(table, org) {
  let all = [];
  for (let start = 0; ; start += 1000) {
    const order =
      table === "rental_settings"
        ? "organization_id"
        : table === "permissions"
          ? "code"
          : table === "role_permissions"
            ? "permission_code"
            : "id";
    let query = client
      .from(table)
      .select("*")
      .order(order)
      .range(start, start + 999);
    if (table === "role_permissions") query = query.order("role_id");
    if (org) query = query.eq("organization_id", org);
    const data = await checked(query);
    all.push(...data);
    if (data.length < 1000) return all;
  }
}
export async function loadState() {
  const context = await rpc("rental_context");
  const state = { context, data: {} };
  if (!context.organization_id) return state;
  const org = context.organization_id;
  const jobs = [
    ["worker_statuses", "rental_worker_statuses"],
    ["contract_statuses", "rental_contract_statuses"],
    ["settings", "rental_settings"],
  ];
  for (const [key, model] of Object.entries(models))
    if (has(context, model.permission)) jobs.push([key, model.table]);
  if (has(context, "salaries"))
    jobs.push(["payments", "rental_salary_payments"]);
  if (has(context, "documents")) jobs.push(["documents", "rental_documents"]);
  if (has(context, "audit")) jobs.push(["audit", "audit_events"]);
  if (context.manager)
    jobs.push(["roles", "roles"], ["role_permissions", "role_permissions"]);
  await Promise.all(
    jobs.map(async ([key, table]) => {
      state.data[key] = await rows(table, org);
    }),
  );
  for (const key of ["worker_statuses", "contract_statuses"])
    state.data[key]?.sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.label.localeCompare(b.label, "ar"),
    );
  if (context.manager) {
    state.data.members = await rpc("rental_member_directory", {
      p_organization_id: org,
    });
    state.data.permissions = await rows("permissions");
  }
  return state;
}
export async function saveRecord(state, kind, data, previous) {
  const table = models[kind]?.table || kind;
  const org = state.context.organization_id;
  let query = previous
    ? client
        .from(table)
        .update(data)
        .eq("organization_id", org)
        .eq("id", previous.id)
        .eq("version", previous.version)
        .select("id")
    : client
        .from(table)
        .insert({ ...data, organization_id: org })
        .select("id");
  const result = await checked(query);
  if (!result.length)
    throw new Error(
      "تم تغيير السجل أو صلاحياتك. حدّث الصفحة قبل المحاولة مجدداً.",
    );
  return result[0];
}
export async function deleteRecord(state, kind, row) {
  const result = await checked(
    client
      .from(models[kind].table)
      .delete()
      .eq("organization_id", state.context.organization_id)
      .eq("id", row.id)
      .eq("version", row.version)
      .select("id"),
  );
  if (!result.length) throw new Error("تغير السجل. يرجى تحديث الصفحة.");
}
export async function saveSettings(state, data) {
  const previous = state.data.settings?.[0];
  let query = previous
    ? client
        .from("rental_settings")
        .update(data)
        .eq("organization_id", state.context.organization_id)
        .eq("version", previous.version)
        .select("organization_id")
    : client
        .from("rental_settings")
        .insert({ ...data, organization_id: state.context.organization_id })
        .select("organization_id");
  const result = await checked(query);
  if (!result.length) throw new Error("تغيرت الإعدادات. حدّث الصفحة.");
}
