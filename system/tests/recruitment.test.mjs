import assert from "node:assert/strict";
import { test } from "node:test";
import { contractMetrics, contractTab, exportRecruitment, payload, previewRecruitment, previewRecruitmentRows, readCsv } from "../web/js/modules/recruitment-data.js";
import { exportRecruitmentWorkbook, readRecruitmentWorkbook } from "../web/js/modules/recruitment-xlsx.js";
import { utils, read, write } from "../web/assets/vendor/sheetjs-0.20.3.mjs";

const date = "2026-11-06";
const contract = {
  ...payload({ employer_name: '=ACME, "Example"', worker_name: "QA Worker", passport_number: "0003",
    contract_number: "0012", opened_on: "2026-09-01", duration_days: 90, visa_issued: true,
    stage: "visa", ticket_on: "2026-11-01", arrived_on: "2026-11-02", notes: "Keep this internal" }),
  id: "id", version: 3,
};
const header = "اسم صاحب العمل|رقم العقد|هوية صاحب العمل|رقم الصادر|المهنة|الجنسية|اسم العاملة|رقم الجواز|اسم الموظفة|مدة الاستقدام|مدينة الوصول|حالة العقد|تاريخ بداية العقد|المتبقي على مدة الاستقدام|حالة التفييز|حالة المتابعة|موعد التذكرة|تاريخ وصول العاملة|حالة الضمان";

test("CSV matches Sheet9 exactly, preserves IDs, and ignores computed cells on reimport", () => {
  const csv = exportRecruitment([contract], date);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const [keys, values] = readCsv(csv);
  assert.equal(keys.join("|"), header);
  assert.equal(values[1], "0012");
  assert.equal(values[7], "0003");
  assert.match(values[0], /^'=/);
  assert.equal(values[13], "24");
  assert.equal(values[18], "في فترة الضمان");
  assert.equal(previewRecruitment(csv, [contract], date)[0].state, "unchanged");
  const [edit] = previewRecruitment(csv.replace(",24,", ",999,").replace("QA Worker", "QA Updated"), [contract], date);
  assert.equal(edit.state, "update");
  assert.equal(edit.change.version, 3);
  assert.equal(edit.change.data.notes, "Keep this internal");
  assert.deepEqual(edit.fields, ["اسم العاملة"]);
});

test("CSV blocks equivalent duplicate numbers and invalid dates; omitted fields are preserved", () => {
  const file = "رقم العقد;تاريخ بداية العقد\r\n0012;2026-09-01\r\n۰۰۱۲;2026-09-02";
  assert.ok(previewRecruitment(file, [contract], date).every(({ state, error }) => state === "error" && error.includes("مكرر")));
  const [invalid] = previewRecruitment("رقم العقد,موعد التذكرة\n0012,2026-02-30", [contract], date);
  assert.equal(invalid.state, "error");
  const [edit] = previewRecruitment("رقم العقد,المهنة\n٠٠١٢,عاملة منزلية", [contract], date);
  assert.equal(edit.change.data.contract_number, "0012");
  assert.equal(edit.change.data.worker_name, "QA Worker");
  assert.equal(edit.change.data.occupation, "عاملة منزلية");
  assert.throws(() => readCsv('a,b\n"x,y'));
});

test("arrival warranty ends 90 days after actual arrival, independent of duration", () => {
  const row = { ...contract, arrived_on: "2026-11-02" };
  assert.equal(contractMetrics(row, "2027-01-30").warranty_remaining, 1);
  assert.equal(contractMetrics(row, "2027-01-31").warranty_state, "خارج الضمان");
  assert.equal(contractMetrics(row, "2027-01-31").warranty_end, "2027-01-31");
  assert.equal(contractMetrics({ ...row, duration_days: null }, date).remaining, null);
  assert.equal(contractTab(row), "arrived");
  assert.equal(contractTab({ ...row, contract_state: "cancelled" }), "archived");
  assert.equal(contractTab({ ...row, arrived_on: null }), "current");
});

test("XLSX preserves the exact template and stores identifiers and formula-like names as text", () => {
  const bytes = exportRecruitmentWorkbook([contract], date);
  const parsed = read(bytes, { type: "array" }).Sheets.Sheet9;
  assert.equal(parsed.A2.t, "s");
  assert.equal(parsed.A2.f, undefined);
  assert.equal(parsed.B2.v, "0012");
  assert.equal(parsed.H2.v, "0003");
  const { matrix, errors } = readRecruitmentWorkbook(bytes);
  assert.equal(matrix[0].join("|"), header);
  assert.equal(previewRecruitmentRows(matrix, [contract], date, errors)[0].state, "unchanged");
});

test("XLSX finds the contract sheet and previews Excel dates and cached lookup results", () => {
  const book = utils.book_new();
  const worksheet = utils.aoa_to_sheet([header.split("|"),
    ["Employer", 12, "", "", "", "", "Worker", "0003", "", 90, "", "سار", "", "", "تم التفييز"],
    ["Employer", "13", "", "", "", "", "Worker", "0003", "", 90, "", "سار", "6/7/2026"]]);
  worksheet.B2.z = "0000";
  worksheet.G2.f = "VLOOKUP(A2,Other!A:B,2,FALSE)";
  worksheet.M2 = { t: "n", z: "m/d/yyyy", v: (Date.UTC(2026, 8, 1) - Date.UTC(1899, 11, 30)) / 86400000 };
  utils.book_append_sheet(book, utils.aoa_to_sheet([["other sheet"]]), "Other");
  utils.book_append_sheet(book, worksheet, "Sheet9");
  const { matrix, errors, sheet } = readRecruitmentWorkbook(write(book, { type: "array", bookType: "xlsx" }));
  const [good, ambiguous] = previewRecruitmentRows(matrix, [], date, errors);
  assert.equal(sheet, "Sheet9");
  assert.equal(good.change.data.contract_number, "0012");
  assert.equal(good.change.data.opened_on, "2026-09-01");
  assert.equal(good.change.data.worker_name, "Worker");
  assert.equal(ambiguous.state, "error");
  assert.match(ambiguous.error, /اليوم والشهر/);
  assert.throws(() => readRecruitmentWorkbook(new ArrayBuffer(24)), /ملف XLSX/);
});
