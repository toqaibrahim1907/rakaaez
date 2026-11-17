import { el, button, badge, empty, money, daysUntil } from "./dom.js";
import {
  models,
  paymentBalance,
  moneyCents,
  paymentState,
} from "../data/model.js";
export function valueFor(state, field, row) {
  const value = row[field.key];
  if (value === null || value === undefined || value === "") return "—";
  if (field.ref)
    return (
      state.data[field.ref]?.find((item) => item.id === value)?.label ||
      state.data[field.ref]?.find((item) => item.id === value)?.name ||
      state.data[field.ref]?.find((item) => item.id === value)
        ?.contract_number ||
      "محجوب حسب الصلاحية"
    );
  if (field.options)
    return field.options.find((option) => option[0] === value)?.[1] || value;
  if (field.type === "money") return money(value, row.currency);
  return String(value);
}
export function table(
  state,
  kind,
  rows,
  { actions = () => [], profile, compact = false } = {},
) {
  const model = models[kind];
  const columns = compact
    ? ["contract_number", "client_id", "worker_id", "end_date", "status_id"]
    : model.columns;
  const head = columns.map((key) => model.fields.find((f) => f.key === key));
  const headings = head.map((f) => f.label);
  if (kind === "contracts") headings.push("المدة المتبقية");
  if (kind === "salaries") headings.push("المدفوع", "المتبقي", "حالة الدفع");
  headings.push("الإجراءات");
  const tbody = el("tbody");
  for (const row of rows) {
    const tr = el(
      "tr",
      {},
      head.map((field, index) => {
        const value = valueFor(state, field, row);
        return el(
          "td",
          {},
          field.key.endsWith("status_id")
            ? badge(value)
            : index === 0 && profile
              ? button(value, () => profile(row), "text-link")
              : value,
        );
      }),
    );
    if (kind === "contracts") {
      const days = daysUntil(row.end_date);
      tr.append(
        el(
          "td",
          {
            class:
              days < 0
                ? "text-red"
                : days <= (state.data.settings?.[0]?.soon_days ?? 7)
                  ? "text-amber"
                  : "",
          },
          days < 0 ? `مضى ${Math.abs(days)} يوم` : `${days} يوم`,
        ),
      );
    }
    if (kind === "salaries") {
      const balance = paymentBalance(state, row);
      tr.append(
        el("td", {}, moneyCents(balance.paid, row.currency)),
        el(
          "td",
          { class: "strong" },
          moneyCents(balance.remaining, row.currency),
        ),
        el(
          "td",
          {},
          badge(
            paymentState(state, row),
            balance.remaining === 0n
              ? "green"
              : balance.remaining < 0n
                ? "red"
                : "slate",
          ),
        ),
      );
    }
    tr.append(el("td", {}, el("div", { class: "row-actions" }, actions(row))));
    tbody.append(tr);
  }
  return el(
    "div",
    { class: "table-scroll" },
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          headings.map((h) => el("th", {}, h)),
        ),
      ),
      tbody,
    ),
    rows.length ? null : empty(),
  );
}
