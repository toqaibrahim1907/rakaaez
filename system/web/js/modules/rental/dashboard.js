import { el, button, daysUntil } from "../../components/dom.js";
import { table } from "../../components/table.js";
import { profile } from "./crud.js";
import { has } from "../../permissions.js";
import { paymentBalance, groupedMoney } from "../../data/model.js";
export function dashboardView(state, refresh, navigate) {
  const workers = (state.data.workers || []).filter((w) => !w.archived_at);
  const activeStatus = state.data.contract_statuses?.find(
    (s) => s.code === "active",
  )?.id;
  const availableStatus = state.data.worker_statuses?.find(
    (s) => s.code === "available",
  )?.id;
  const soon = state.data.settings?.[0]?.soon_days ?? 7;
  const contracts = state.data.contracts || [];
  const expiring = contracts.filter(
    (c) =>
      c.status_id === activeStatus &&
      daysUntil(c.end_date) >= 0 &&
      daysUntil(c.end_date) <= soon,
  );
  const salaryTotal = groupedMoney(
    state.data.salaries || [],
    (row) => paymentBalance(state, row).remaining,
  );
  const statusTotals = (state.data.worker_statuses || []).map((status) => ({
    label: status.label,
    count: workers.filter((worker) => worker.availability_status_id === status.id).length,
  }));
  const card = (title, value, description, tone, symbol, target, area) =>
    el(
      "button",
      {
        class: "stat " + tone,
        type: "button",
        disabled: !has(state.context, area),
        onClick: () => navigate(target),
      },
      el(
        "div",
        { class: "stat-top" },
        el("span", { class: "stat-icon" }, symbol),
        el("span", {}, "↖"),
      ),
      el("strong", {}, value),
      el("h3", {}, title),
      el("small", {}, description),
    );
  return el(
    "div",
    {},
    el("section", { class: "dashboard-hero" },
      el("div", {}, el("small", {}, "منظومة إدارة الكوادر والعمليات"),
        el("h2", {}, "لوحة العمليات الرئيسية"),
        el("p", {}, "تابع العقود والعاملات والسكن والطلبات من مساحة واحدة.")),
      has(state.context, "contracts", "write")
        ? button("عقود التأجير ↖", () => navigate("contracts"), "primary") : null),
    el(
      "div",
      { class: "overview-label" },
      el("span", { class: "live-dot" }),
      "ملخص العمليات",
      el("small", {}, "محدّث من السجلات المحفوظة"),
    ),
    el(
      "div",
      { class: "stats-grid" },
      ...[
        ["الاستقدام", "recruitment", "✈", (row) => !["completed","cancelled"].includes(row.stage)],
        ["المقيمات في السكن", "housing", "⌂", (row) => !row.left_on],
        ["طلبات العملاء الجديدة", "requests", "▧", (row) => row.status === "new"],
        ["الشكاوى الجديدة", "complaints", "⚠", (row) => row.status === "new"],
      ].filter(([, kind]) => has(state.context, kind)).map(([title, kind, symbol, filter]) =>
        card(title, (state.data[kind] || []).filter(filter).length, "حسب السجلات المحفوظة", "blue", symbol, kind, kind)),
      card(
        "مبالغ الرواتب المتبقية",
        has(state.context, "salaries") ? salaryTotal : "—",
        "من المستحقات المدخلة يدوياً",
        "orange",
        "▣",
        "salaries",
        "salaries",
      ),
      card(
        "عقود تنتهي قريباً",
        has(state.context, "contracts") ? expiring.length : "—",
        `خلال ${soon} أيام · العقود المسجلة كنشطة`,
        "amber",
        "▦",
        "contracts",
        "contracts",
      ),
      card(
        "العقود النشطة",
        has(state.context, "contracts")
          ? contracts.filter((c) => c.status_id === activeStatus).length
          : "—",
        "بحسب الحالة المسجلة",
        "blue",
        "▤",
        "contracts",
        "contracts",
      ),
      card(
        "عاملات متاحات للتأجير",
        has(state.context, "workers")
          ? workers.filter((w) => w.availability_status_id === availableStatus)
              .length
          : "—",
        "بحسب حالة التوفر المسجلة",
        "green",
        "♧",
        "workers",
        "workers",
      ),
    ),
    el(
      "section",
      { class: "panel" },
      has(state.context, "workers") ? workforceDistribution(statusTotals, workers.length) : null,
      el(
        "div",
        { class: "panel-heading" },
        el(
          "div",
          {},
          el("h2", {}, "عقود تنتهي قريباً"),
          el("p", {}, "نافذة عرض فقط، دون تغيير تواريخ العقود"),
        ),
        has(state.context, "contracts")
          ? button("كل العقود ↖", () => navigate("contracts"), "text-link")
          : null,
      ),
      has(state.context, "contracts")
        ? table(state, "contracts", expiring, {
            compact: true,
            profile: (row) => profile(state, "contracts", row, refresh),
          })
        : el("p", { class: "muted" }, "يتطلب صلاحية عرض العقود"),
    ),
    el(
      "div",
      { class: "dashboard-bottom" },
      el(
        "section",
        { class: "panel" },
        el("div", { class: "panel-heading" }, el("h2", {}, "حالة العاملات")),
        (state.data.worker_statuses || []).map((status) =>
          el(
            "div",
            { class: "distribution" },
            el(
              "span",
              {},
              el("i", { style: "background:#149b7b" }),
              status.label,
            ),
            el(
              "b",
              {},
              has(state.context, "workers")
                ? workers.filter((w) => w.availability_status_id === status.id)
                    .length
                : "—",
            ),
          ),
        ),
      ),
      el(
        "section",
        { class: "panel quick-start" },
        el("span", { class: "quick-icon" }, "▤"),
        el("h2", {}, "كل تفاصيل التأجير في مكان واحد"),
        el(
          "p",
          {},
          "أضف العاملة والعميل، ثم سجّل العقد والمستحقات وفق البيانات المعتمدة.",
        ),
        has(state.context, "contracts")
          ? button("عرض العقود ←", () => navigate("contracts"))
          : null,
      ),
    ),
  );
}

function workforceDistribution(statuses, total) {
  const colors = ["#0f2744", "#006a61", "#496084", "#86f2e4"];
  let angle = 0;
  const active = statuses.filter(({ count }) => count);
  const bands = active.map(({ count }, index) => {
    const start = angle;
    angle += count * 100 / total;
    return `${colors[index % colors.length]} ${start}% ${angle}%`;
  });
  const background = bands.length ? "conic-gradient(" + bands.join(",") + ")" : "#edf2ff";
  return el("div", { class: "workforce-distribution" },
    el("div", { class: "workforce-ring", style: "background:" + background, "aria-hidden": "true" }, el("strong", {}, total)),
    el("div", {}, el("h2", {}, "توزيع العاملات حسب الحالة"),
      el("p", {}, "إجمالي العاملات " + total),
      active.map(({ label, count }, index) =>
        el("div", { class: "distribution" },
          el("span", {}, el("i", { style: "background:" + colors[index % colors.length] }), label),
          el("strong", {}, count)))));
}
