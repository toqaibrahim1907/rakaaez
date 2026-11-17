import { el, button, hint, money } from "../../components/dom.js";
import { table, valueFor } from "../../components/table.js";
import {
  models,
  dateKeys,
  paymentBalance,
  groupedMoney,
  cents,
} from "../../data/model.js";
import { has } from "../../permissions.js";
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function reportsView(state) {
  const allowed = ["contracts", "workers", "salaries", "evaluations", "recruitment", "housing", "employees", "leaves", "complaints", "requests"].filter(
    (k) => has(state.context, k),
  );
  if (!allowed.length)
    return el(
      "section",
      { class: "panel empty" },
      "لا توجد صلاحية لعرض بيانات التقارير.",
    );
  let kind = allowed[0];
  const tabs = el("div", { class: "tabs" });
  const content = el("div");
  const query = el("input", {
      type: "search",
      placeholder: "بحث في التقرير…",
      "aria-label": "البحث في التقرير",
    }),
    from = el("input", { type: "date", "aria-label": "من تاريخ" }),
    to = el("input", { type: "date", "aria-label": "إلى تاريخ" });
  const status = el("select", { "aria-label": "حالة التقرير" });
  const dateText = hint("");
  let filtered = [];
  function draw() {
    const model = models[kind];
    filtered = (state.data[kind] || []).filter((row) => {
      const date = String(row[dateKeys[kind]] || "").slice(0, 10);
      const statusValue =
        row.status_id ||
        row.availability_status_id ||
        row.administrative_state ||
        row.stage || row.status || row.reason ||
        "";
      return (
        (!from.value || date >= from.value) &&
        (!to.value || date <= to.value) &&
        (!status.value || statusValue === status.value) &&
        (!query.value ||
          model.fields
            .map((f) => valueFor(state, f, row))
            .join(" ")
            .toLowerCase()
            .includes(query.value.trim().toLowerCase()))
      );
    });
    const summaries = [
      el(
        "div",
        {},
        el("span", {}, "عدد السجلات"),
        el("b", {}, filtered.length),
      ),
    ];
    if (kind === "salaries") {
      const p = groupedMoney(
          filtered,
          (row) => paymentBalance(state, row).paid,
        ),
        r = groupedMoney(
          filtered,
          (row) => paymentBalance(state, row).remaining,
        );
      summaries.push(
        el("div", {}, el("span", {}, "إجمالي المدفوع"), el("b", {}, p)),
        el("div", {}, el("span", {}, "المتبقي"), el("b", {}, r)),
      );
    }
    if (kind === "contracts")
      summaries.push(
        el(
          "div",
          {},
          el("span", {}, "مجموع مبالغ العقود"),
          el(
            "b",
            {},
            groupedMoney(filtered, (row) => cents(row.amount)),
          ),
        ),
      );
    content.replaceChildren(
      el("div", { class: "report-summary" }, summaries),
      el("section", { class: "panel" }, table(state, kind, filtered)),
    );
  }
  function select(next) {
    kind = next;
    query.value = "";
    status.replaceChildren(el("option", { value: "" }, "كل الحالات"));
    const field = models[kind].fields.find((f) =>
      ["status_id", "availability_status_id", "administrative_state", "stage", "status", "reason"].includes(
        f.key,
      ),
    );
    for (const [value, label] of field?.options ||
      (state.data[field?.ref] || []).map((s) => [s.id, s.label]))
      status.append(el("option", { value }, label));
    status.disabled = !field;
    dateText.textContent =
      "الفترة حسب: " +
      {
        contracts: "بداية العقد",
        workers: "تاريخ إنشاء الملف",
        salaries: "تاريخ الاستحقاق",
        evaluations: "تاريخ التقييم",
        recruitment: "تاريخ فتح العقد",
        housing: "تاريخ دخول السكن",
        employees: "تاريخ التعيين",
        leaves: "تاريخ بداية الإجازة",
        complaints: "تاريخ استلام الشكوى",
        requests: "تاريخ استلام الطلب",
      }[kind];
    tabs
      .querySelectorAll("button")
      .forEach((b) => b.classList.toggle("selected", b.dataset.kind === kind));
    draw();
  }
  for (const key of allowed)
    tabs.append(
      button(models[key].title, () => select(key), "", { "data-kind": key }),
    );
  for (const input of [query, from, to, status])
    input.addEventListener(input === query ? "input" : "change", draw);
  function download() {
    const model = models[kind];
    const csv =
      "\uFEFF" +
      [
        model.fields.map((f) => f.label),
        ...filtered.map((row) =>
          model.fields.map((f) => valueFor(state, f, row)),
        ),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    el("a", { href: url, download: `rental-${kind}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const section = el(
    "div",
    {},
    el(
      "section",
      { class: "panel" },
      el(
        "div",
        { class: "panel-heading" },
        el("h2", {}, "تقارير العمليات"),
        button("تنزيل CSV", download),
      ),
      tabs,
      dateText,
      el(
        "div",
        { class: "filters" },
        el("label", { class: "search" }, "⌕", query),
        status,
        el("label", { class: "date-filter" }, "من", from),
        el("label", { class: "date-filter" }, "إلى", to),
      ),
    ),
    content,
  );
  select(kind);
  return section;
}
