import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
const { window, document } = parseHTML(
  '<html><body><div id="modal-title"></div><div id="modal-body"></div><div id="record-modal"></div></body></html>',
);
globalThis.document = document;
globalThis.Node = window.Node;
globalThis.bootstrap = {
  Modal: { getOrCreateInstance: () => ({ show() {} }) },
};
const { workersView } = await import("../web/js/modules/rental/workers.js");
const { contractsView } = await import("../web/js/modules/rental/contracts.js");
const { salariesView } = await import("../web/js/modules/rental/salaries.js");
const { documentsView } = await import("../web/js/modules/rental/documents.js");
const { evaluationsView } = await import(
  "../web/js/modules/rental/evaluations.js"
);
const { clientsView } = await import("../web/js/modules/rental/clients.js");
const { archiveView } = await import("../web/js/modules/rental/archive.js");
const { dashboardView } = await import("../web/js/modules/rental/dashboard.js");
const { settingsView } = await import("../web/js/modules/rental/settings.js");
const { reportsView } = await import("../web/js/modules/rental/reports.js");
const { el, today } = await import("../web/js/components/dom.js");
const { recruitmentPages, recruitmentView } = await import("../web/js/modules/recruitment.js");
const state = {
  context: {
    organization_id: "org",
    manager: true,
    permissions: [
      "workers",
      "workers_private",
      "clients",
      "clients_private",
      "contracts",
      "salaries",
      "documents",
      "evaluations",
      "reports",
      "settings",
    ].flatMap((p) => ["rental." + p + ".read", "rental." + p + ".write"]),
  },
  data: {
    workers: [
      {
        id: "worker",
        name: "<img src=x onerror=alert(1)>",
        nationality: "Test",
        availability_status_id: "available",
        version: 1,
      },
    ],
    worker_statuses: [
      { id: "available", code: "available", label: "متاحة", is_active: true },
    ],
    contract_statuses: [
      { id: "active", code: "active", label: "نشط", is_active: true },
    ],
    contracts: [],
    clients: [],
    salaries: [],
    payments: [],
    documents: [],
    evaluations: [],
    settings: [{ soon_days: 7, salary_mode: "manual", version: 1 }],
  },
};
test("shared DOM helper renders user strings as text", () => {
  const node = el("div", {}, "<img src=x onerror=alert(1)>");
  assert.equal(node.querySelector("img"), null);
  assert.match(node.textContent, /<img/);
});
test("all rental views render without null artifacts or injected HTML", () => {
  for (const view of [
    workersView,
    clientsView,
    contractsView,
    salariesView,
    documentsView,
    evaluationsView,
    archiveView,
    dashboardView,
    settingsView,
    reportsView,
  ]) {
    const result = view(
      state,
      async () => {},
      () => {},
    );
    assert.ok(result instanceof Node, view.name);
    assert.equal(result.querySelector("img"), null, view.name);
    assert.ok(!result.textContent.includes("null"), view.name);
  }
});
test("worker filtering updates rows without changing the data", () => {
  const view = workersView(state, async () => {});
  const input = view.querySelector("input[type=search]");
  input.value = "unmatched";
  input.dispatchEvent(new window.Event("input"));
  assert.equal(view.querySelectorAll("tbody tr").length, 0);
  input.value = "<img";
  input.dispatchEvent(new window.Event("input"));
  assert.equal(view.querySelectorAll("tbody tr").length, 1);
  assert.equal(state.data.workers.length, 1);
});
test("recruitment pages separate follow-up, arrivals and archived contracts, with warranty days on arrivals", () => {
  const dateBefore = (days) => new Date(Date.parse(today()) - days * 86400000).toISOString().slice(0, 10);
  const source = [
    { id: "1", contract_number: "QA1", employer_name: "<img src=x>", contract_state: "active" },
    { id: "2", contract_number: "QA2", arrived_on: dateBefore(1), contract_state: "active" },
    { id: "3", contract_number: "QA3", contract_state: "cancelled" },
    { id: "4", contract_number: "QA4", arrived_on: dateBefore(90), contract_state: "active" },
  ];
  assert.equal(new Set(recruitmentPages.map(([route]) => route)).size, 3);
  const number = new Intl.NumberFormat("ar-SA");
  for (const [, title, , tab] of recruitmentPages) {
    const view = recruitmentView({ context: { organization_id: "org", permissions: ["rental.recruitment.read"] },
      data: { recruitment: source } }, () => {}, { id: "reader" }, () => {}, tab);
    const contracts = [...view.querySelectorAll("tbody tr")].map((row) => row.textContent.match(/QA\d/)[0]);
    assert.equal(view.querySelector("h1").textContent, title);
    assert.equal(view.querySelector("img"), null);
    assert.doesNotMatch(view.textContent, /إضافة عقد|أرشفة العقود/);
    assert.deepEqual(contracts, { current: ["QA1"], arrived: ["QA2", "QA4"], archived: ["QA3"] }[tab]);
    if (tab === "arrived") {
      const headers = [...view.querySelectorAll("thead th")].map((cell) => cell.textContent);
      const start = headers.indexOf("بداية الضمان (تاريخ الوصول)");
      assert.ok(start >= 0);
      assert.deepEqual(headers.slice(start + 1, start + 3), ["أيام الضمان المتبقية", "نهاية الضمان"]);
      const days = [...view.querySelectorAll("tbody td.recruitment-warranty-days strong")].map((cell) => cell.textContent);
      assert.deepEqual(days, [89, 0].map((value) => number.format(value)));
    }
  }
});
test("an empty arrivals page still shows the warranty column between the warranty dates", () => {
  const view = recruitmentView({ context: { organization_id: "org", permissions: ["rental.recruitment.write"] },
    data: {} }, () => {}, { id: "writer" }, () => {}, "arrived");
  const columns = [...view.querySelectorAll("thead th")].map((cell) => cell.textContent);
  assert.deepEqual(columns.slice(-4), ["بداية الضمان (تاريخ الوصول)", "أيام الضمان المتبقية", "نهاية الضمان", "حالة الضمان"]);
  assert.match(view.querySelector("tbody").textContent, /لا توجد عقود تم تأكيد وصولها/);
});
test("new recruitment contracts offer seven nationalities and the four requested statuses", () => {
  const view = recruitmentView({ context: { organization_id: "org", permissions: ["rental.recruitment.write"] },
    data: {} }, () => {}, { id: "writer" }, () => {});
  view.querySelector(".recruitment-hero-actions .primary").click();
  const modal = document.querySelector("#modal-body");
  const chooseStep = (n) => modal.querySelectorAll(".recruitment-steps button")[n].click();
  chooseStep(1);
  const options = (name) => [...modal.querySelectorAll(`select[name=${name}] option`)].slice(1).map((option) => option.textContent);
  assert.deepEqual(options("nationality"), ["إثيوبيا", "أوغندا", "بوروندي", "كينيا", "بنغلاديش", "الفلبين", "سريلانكا"]);
  chooseStep(2);
  assert.equal(modal.querySelector("[name=expected_on], [name=duration_days]"), null);
  assert.deepEqual(options("stage"), ["تم اختيار العاملة", "اجتازت العاملة الفحص الطبي", "استكملت أوراقها والبصمة", "تم التفييز"]);
});
