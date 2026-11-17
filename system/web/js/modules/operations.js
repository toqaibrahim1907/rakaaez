import { el } from "../components/dom.js";
import { crudView } from "./rental/crud.js";
import { models } from "../data/model.js";

const tiles = {
  recruitment: [
    ["قيد المتابعة", (row) => !["completed", "cancelled"].includes(row.stage)],
    ["مكتملة", (row) => row.stage === "completed"],
    ["ملغاة", (row) => row.stage === "cancelled"],
  ],
  housing: [
    ["مقيمات حالياً", (row) => !row.left_on],
    ["متاحات للتأجير", (row) => !row.left_on && row.reason === "available"],
    ["بانتظار السفر", (row) => !row.left_on && row.reason === "travel"],
  ],
  employees: [["نشطون", (row) => row.status === "active"]],
  leaves: [["بانتظار القرار", (row) => row.status === "pending"]],
  complaints: [["جديدة", (row) => row.status === "new"]],
  requests: [["جديدة", (row) => row.status === "new"]],
};

export function operationsView(state, kind, refresh) {
  const rows = state.data[kind] || [];
  const counts = [["إجمالي السجلات", rows.length],
    ...tiles[kind].map(([label, filter]) => [label, rows.filter(filter).length])];
  const records = el("div", {}, crudView(state, kind, refresh));
  const stages = kind === "recruitment" ? recruitmentStages(rows, records) : null;
  return el("div", {},
    el("div", { class: "stats-grid" }, counts.map(([label, count], index) =>
      el("div", { class: "stat " + (index === 1 ? "green" : "blue") },
        el("span", { class: "stat-icon" }, "▦"), el("strong", {}, count), el("h3", {}, label)))),
    stages, records);
}

function recruitmentStages(rows, records) {
  const choices = [["", "كل المراحل"], ...models.recruitment.fields.find((field) => field.key === "stage").options];
  const buttons = el("div", { class: "recruitment-stages" });
  for (const [code, label] of choices) {
    const filter = el("button", { type: "button", "aria-pressed": String(!code) },
      el("strong", {}, code ? rows.filter((row) => row.stage === code).length : rows.length), label);
    filter.addEventListener("click", () => {
      const select = records.querySelector('select[aria-label="الحالة"]');
      select.value = code;
      select.dispatchEvent(new Event("change"));
    });
    buttons.append(filter);
  }
  records.querySelector('select[aria-label="الحالة"]').addEventListener("change", (event) => {
    [...buttons.children].forEach((button, index) =>
      button.setAttribute("aria-pressed", String(choices[index][0] === event.target.value)));
  });
  return el("section", { class: "panel" }, el("h2", {}, "مسار مراحل الاستقدام"), buttons);
}

const entityLabels = Object.fromEntries(Object.values(models).map((model) => [model.table, model.title]));
const actions = { insert: "إضافة", update: "تعديل", delete: "حذف", role_save: "حفظ دور", member_assign: "تعيين عضو" };
const auditTime = new Intl.DateTimeFormat("ar-EG", {
  timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short",
});

export function auditView(state) {
  const rows = [...(state.data.audit || [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const members = new Map((state.data.members || []).map((member) => [member.user_id, member.email]));
  return el("section", { class: "panel" }, el("div", { class: "table-scroll" },
    el("table", {},
      el("thead", {}, el("tr", {}, ["التوقيت", "العملية", "القسم", "المستخدم"].map((label) => el("th", {}, label)))),
      el("tbody", {}, rows.map((row) => el("tr", {},
        el("td", {}, auditTime.format(new Date(row.occurred_at))),
        el("td", {}, actions[row.action] || row.action),
        el("td", {}, entityLabels[row.entity_type] || row.entity_type),
        el("td", {}, row.actor_id ? members.get(row.actor_id) || row.actor_id : "النظام"))))),
    rows.length ? null : el("p", { class: "empty" }, "لا توجد عمليات مسجلة.")));
}
