import { badge, button, dateLabel, el, empty, notify, showError, today } from "../components/dom.js";
import { closeModal, modal } from "../components/modal.js";
import { rpc } from "../data/repository.js";
import { has } from "../permissions.js";
import {
  columns, contractKey, contractMetrics, contractTab, convertField, displayValue,
  editableColumns, exportRecruitment, payload, previewRecruitment, previewRecruitmentRows,
  recruitmentNationalities, requestStages, validateContract,
} from "./recruitment-data.js";

export const recruitmentPages = [
  ["recruitment", "العقود قيد المتابعة", "▤", "current"],
  ["recruitment-arrived", "تم تأكيد الوصول", "✈", "arrived"],
  ["recruitment-archived", "عقود استقدام مؤرشفة", "▥", "archived"],
];
const tableKeys = {
  current: columns.slice(0, 20).map(([key]) => key),
  arrived: ["contract_number", "employer_name", "nationality", "worker_name", "passport_number",
    "employee_name", "arrival_city", "arrived_on", "warranty_remaining", "warranty_end", "warranty_state"],
  archived: ["employer_name", "contract_number", "worker_name", "passport_number", "nationality",
    "opened_on", "contract_state", "notes", "archive_reason", "updated_at"],
};
const filterOptions = {
  current: [["all", "الكل"], ["following", "قيد المتابعة"], ["near", "قريبة الانتهاء"],
    ["late", "متأخرة"], ["complete", "مكتملة"], ["no-arrival", "شهران دون تأكيد الوصول"],
    ["visa", "تم التفييز"], ["no-visa", "لم يتم التفييز"], ["elapsed", "مضى ٤٥–٦٠ يومًا"]],
  arrived: [["all", "الكل"], ["warranty", "داخل الضمان"], ["out", "خارج الضمان"]],
  archived: [["all", "الكل"], ["cancelled", "ملغاة"], ["manual", "مؤرشفة أخرى"]],
};
const pageSize = 20;
const position = new Map();
const byKey = (key) => columns.find(([field]) => key === field);
const number = new Intl.NumberFormat("ar-SA");
const workflow = [
  ["request", "الطلب والتفويض", "▤"],
  ...requestStages.map(([key, label], index) => [key, label, ["▧", "◎", "▤", "◈"][index]]),
  ["travel", "تذكرة الطيران", "✈"], ["arrival", "الوصول والمطار", "⌖"],
  ["handover", "التسليم للعميل", "✓"],
];
const steps = [
  ["معلومات السجل", []],
  ["العقد والعميل", ["contract_number", "employee_name", "worker_name", "passport_number",
    "employer_name", "employer_identity", "visa_number", "nationality", "arrival_city", "occupation"]],
  ["المتابعة والوصول", ["opened_on", "ticket_on", "contract_state",
    "visa_issued", "stage", "arrived_on", "trial", "client_rights", "housing_transferred", "notes"]],
  ["مراجعة وحفظ", []],
];
const required = new Set(["contract_number", "worker_name", "passport_number", "employer_name", "opened_on"]);
const fieldLabel = (key) => key === "stage" ? "حالة الطلب" : byKey(key)[1];
const nationalityKey = (value) => contractKey(value).replace(/[أإآ]/g, "ا").replace(/\s+/g, "");
function nationalityOptions(current) {
  const matches = recruitmentNationalities.find((name) => nationalityKey(name) === nationalityKey(current));
  const choices = recruitmentNationalities.map((name) => [matches === name ? current : name, name]);
  if (current && !matches) choices.unshift([current, current + " (محفوظة سابقًا)"]);
  return choices;
}

function enriched(data) {
  const clients = new Map((data.clients || []).map((row) => [row.id, row]));
  const workers = new Map((data.workers || []).map((row) => [row.id, row]));
  return (data.recruitment || []).map((row) => ({
    ...row, employer_name: row.employer_name || clients.get(row.client_id)?.name,
    worker_name: row.worker_name || workers.get(row.worker_id)?.name,
    passport_number: row.passport_number || workers.get(row.worker_id)?.passport_number,
    nationality: row.nationality || workers.get(row.worker_id)?.nationality,
  })).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "") || a.id.localeCompare(b.id));
}

async function saveBatch(state, changes) {
  try {
    await rpc("save_recruitment_batch", { p_org: state.context.organization_id, p_rows: changes });
  } catch (error) {
    if (error.code === "40001") throw new Error("تغيّر أحد العقود بعد المعاينة. حدّث البيانات وراجع التعديلات مجددًا.");
    throw error;
  }
}

function changesFor(row, data) {
  return { id: row?.id, version: row?.version, data: payload(data) };
}

function editor(state, row, user, date, refresh, openTab) {
  const draft = row ? payload(row) : payload({
    employee_name: user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email,
    visa_issued: false,
  });
  let step = 0;
  const errors = el("div");
  const body = el("div", { class: "recruitment-editor" });
  const controls = new Map();
  const form = el("form", { novalidate: true }, errors, body);
  const submit = el("button", { class: "primary", type: "submit" }, "حفظ السجل");

  function collect() {
    for (const [key, input] of controls) {
      const [, , format] = byKey(key);
      try {
        draft[key] = format === "boolean" ? input.checked : convertField(input.value ?? "", format);
      } catch (error) {
        input.focus();
        throw new Error(fieldLabel(key) + ": " + error.message);
      }
    }
    draft.stage ||= "request";
    draft.contract_state ||= "active";
  }

  function move(next) {
    try {
      collect();
      if (next === 3) validateContract(draft, row, date);
      step = next;
      render();
      body.querySelector("[aria-current='step']")?.focus();
    } catch (error) { showError(error, errors); }
  }

  function field(key) {
    const [, , format] = byKey(key);
    const isRequired = required.has(key) && (!row || ["contract_number", "opened_on"].includes(key) ||
      (key === "employer_name" && !row.client_id));
    const attrs = { class: "form-control", name: key, required: isRequired,
      readonly: key === "employee_name" || (key === "contract_number" && !!row) || null };
    let input;
    const current = draft[key];
    const legacyStage = key === "stage" && current && current !== "request" && !requestStages.some(([code]) => code === current);
    const choices = key === "nationality" ? nationalityOptions(current) : key === "stage" ?
      [...(legacyStage ? [[current, displayValue(draft, byKey(key), date) + " (محفوظة سابقًا)"]] : []), ...requestStages] : format;
    if (Array.isArray(choices)) {
      input = el("select", { ...attrs, class: "form-select" },
        el("option", { value: "", selected: current == null || (key === "stage" && current === "request") },
          key === "nationality" ? "اختر الجنسية" : key === "stage" ? "اختر حالة الطلب" : "—"),
        choices.map(([code, name]) => el("option", { value: code, selected: code === String(current) }, name)));
    } else if (format === "textarea") {
      input = el("textarea", { ...attrs, rows: 3 });
    } else {
      input = el("input", { ...attrs, type: format === "boolean" ? "checkbox" :
        ["number", "date"].includes(format) ? format : "text",
        class: format === "boolean" ? "form-check-input" : "form-control",
        min: format === "number" ? 1 : null, max: format === "number" ? 3650 : key === "arrived_on" ? date : null });
    }
    if (format === "boolean") input.checked = !!draft[key];
    else if (!Array.isArray(choices)) input.value = current ?? "";
    if (key === "visa_issued") input.addEventListener("change", () => {
      const stage = controls.get("stage");
      if (input.value === "true" && stage.value === "") stage.value = "visa";
      if (input.value === "false" && stage.value === "visa") stage.value = "";
    });
    if (key === "stage") input.addEventListener("change", () => {
      if (input.value === "visa") controls.get("visa_issued").value = "true";
    });
    controls.set(key, input);
    return el("label", { class: "recruitment-field" + (format === "boolean" ? " toggle" : "") },
      el("span", {}, fieldLabel(key), isRequired ? " *" : ""), input);
  }

  function render() {
    errors.replaceChildren();
    controls.clear();
    const progress = el("nav", { class: "recruitment-steps", "aria-label": "خطوات العقد" },
      steps.map(([label], index) => button(`${number.format(index + 1)}. ${label}`, () => move(index),
        index === step ? "primary" : "secondary", { "aria-current": index === step ? "step" : null })));
    let content;
    if (step === 0) {
      content = el("div", { class: "recruitment-notice" },
        el("strong", {}, "نموذج متابعة الاستقدام"),
        el("p", {}, "أدخل بيانات العقد والعاملة، ثم سجّل التأشيرة والرحلة والوصول الفعلي في خطوة المتابعة."));
    } else if (step === 3) {
      content = el("dl", { class: "recruitment-grid" }, steps.slice(1, 3).flatMap(([, fields]) => fields)
        .map((key) => el("div", { class: "recruitment-field" }, el("dt", {}, fieldLabel(key)),
          el("dd", {}, displayValue(draft, byKey(key), date) || "—"))));
    } else {
      content = el("div", { class: "recruitment-grid" }, steps[step][1].map(field));
    }
    body.replaceChildren(progress, content, el("footer", { class: "modal-footer" },
      button("إغلاق", closeModal),
      step > 0 && button("السابق", () => move(step - 1)),
      step < 3 && button("التالي", () => move(step + 1), "primary"),
      step === 3 && submit));
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (step < 3) { move(step + 1); return; }
    submit.disabled = true;
    try {
      validateContract(draft, row, date);
      await saveBatch(state, [changesFor(row, draft)]);
      openTab(contractTab(draft));
      closeModal();
      notify("تم حفظ عقد الاستقدام.");
      await refresh();
    } catch (error) { showError(error, errors); }
    finally { submit.disabled = false; }
  });
  render();
  modal(row ? "تعديل عقد الاستقدام" : "إضافة عقد استقدام", form, { section: "إدارة الاستقدام" });
}

async function download(rows, date, format, template) {
  const contents = format === "xlsx" ? (await import("./recruitment-xlsx.js")).exportRecruitmentWorkbook(rows, date) :
    exportRecruitment(rows, date);
  const mime = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv;charset=utf-8";
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = el("a", { href: url, download: `recruitment-${template ? "template" : date}.${format}` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exchange(state, rows, visible, date, refresh, canWrite) {
  const errors = el("div");
  const output = el("div", { class: "recruitment-file-results" });
  const message = el("div", { class: "recruitment-file-message", role: "status" });
  const input = el("input", { type: "file", accept: ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", class: "form-control" });
  const save = el("button", { class: "primary recruitment-file-save", type: "submit", disabled: true }, "اعتماد الاستيراد");
  const skip = el("input", { type: "checkbox", class: "form-check-input" });
  const skipLabel = el("label", { class: "recruitment-file-skip", hidden: true }, skip, "استيراد الصفوف الصالحة فقط وتخطي التكرارات والأخطاء");
  let changes = [];
  let pending = false;
  let analyzed = [];
  let category = "all";
  let page = 0;
  const kinds = {
    insert: ["عقود جديدة", "جديد"], update: ["عقود معدّلة", "تعديل"],
    duplicate: ["سجلات مكررة", "مكرر"], error: ["بيانات غير صالحة", "خطأ"],
    unchanged: ["دون تغيير", "دون تغيير"],
  };
  const kind = (row) => row.duplicate ? "duplicate" : row.state;
  function chooseChanges() {
    const hasErrors = analyzed.some((row) => row.state === "error");
    changes = hasErrors && !skip.checked ? [] : analyzed.flatMap((row) => row.change ? [row.change] : []);
    save.textContent = changes.length ? `اعتماد الاستيراد (${number.format(changes.length)} صف)` : "اعتماد الاستيراد";
    save.disabled = pending || !changes.length;
  }
  skip.addEventListener("change", chooseChanges);
  function renderResults() {
    const filtered = category === "all" ? analyzed : analyzed.filter((row) => kind(row) === category);
    const counts = Object.fromEntries(Object.keys(kinds).map((key) => [key, 0]));
    for (const row of analyzed) counts[kind(row)]++;
    const start = page * 30;
    const columns = ["حالة المطابقة", "رقم العقد", "اسم العميل", "اسم العاملة", "مرحلة المتابعة", "ملاحظات المعاينة"];
    output.replaceChildren(
      el("div", { class: "recruitment-file-cards", "aria-label": "تصفية نتائج الملف" },
        Object.entries(kinds).filter(([key]) => key !== "unchanged").map(([key, [label]]) =>
          button([el("span", {}, label), el("strong", {}, `${number.format(counts[key])} صف`)],
            () => { category = category === key ? "all" : key; page = 0; renderResults(); }, "file-" + key,
            { "aria-pressed": category === key }))),
      el("div", { class: "recruitment-preview-toolbar" },
        el("span", {}, `نتائج فحص الملف: ${number.format(analyzed.length)} صف · دون تغيير: ${number.format(counts.unchanged)}`),
        category !== "all" && button("عرض كل الصفوف", () => { category = "all"; page = 0; renderResults(); })),
      el("div", { class: "recruitment-preview table-responsive", tabindex: "0", "aria-label": "معاينة الاستيراد" },
        el("table", { class: "data-table recruitment-table recruitment-file-table" },
          el("thead", {}, el("tr", {}, columns.map((label) => el("th", { scope: "col" }, label)))),
          el("tbody", {}, filtered.length ? filtered.slice(start, start + 30).map((row) => el("tr", { class: "file-" + kind(row) },
            el("td", {}, el("span", { class: "recruitment-file-badge" }, kinds[kind(row)][1])),
            el("td", {}, el("bdi", {}, row.number || "—")),
            el("td", {}, row.employer || "—"), el("td", {}, row.worker || "—"), el("td", {}, row.stage || "—"),
            el("td", {}, row.error ? `صف ${number.format(row.line)}: ${row.error}` :
              row.fields?.length ? row.fields.join("، ") : row.state === "insert" ? "جاهز للإضافة" : "—"))) :
            el("tr", {}, el("td", { colspan: columns.length }, "لا توجد صفوف في هذه الفئة"))))),
      filtered.length > 30 && el("div", { class: "recruitment-pagination" },
        el("span", {}, `صفحة ${number.format(page + 1)} من ${number.format(Math.ceil(filtered.length / 30))}`),
        button("السابق", () => { page--; renderResults(); }, "secondary", { disabled: !page }),
        button("التالي", () => { page++; renderResults(); }, "secondary", { disabled: start + 30 >= filtered.length })));
  }
  input.addEventListener("change", async () => {
    const file = input.files[0];
    changes = [];
    analyzed = [];
    skip.checked = false;
    skipLabel.hidden = true;
    save.disabled = true;
    errors.replaceChildren();
    output.replaceChildren();
    message.textContent = "";
    save.textContent = "اعتماد الاستيراد";
    if (!file) return;
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > 5_000_000) throw new Error("اختر ملف CSV أو XLSX لا يتجاوز ٥ ميغابايت.");
      message.textContent = "جارٍ فحص " + file.name + "…";
      const bytes = await file.arrayBuffer();
      let preview, sheet;
      if (/\.xlsx$/i.test(file.name)) {
        const workbook = (await import("./recruitment-xlsx.js")).readRecruitmentWorkbook(bytes);
        sheet = workbook.sheet;
        preview = previewRecruitmentRows(workbook.matrix, rows, date, workbook.errors);
      } else {
        let source;
        try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
        catch { throw new Error("احفظ الملف بصيغة CSV UTF-8 ثم حاول مجددًا."); }
        preview = previewRecruitment(source, rows, date);
      }
      if (input.files[0] !== file) return;
      analyzed = preview;
      category = "all";
      page = 0;
      message.textContent = sheet ? `${file.name} · الورقة: ${sheet}` : file.name;
      renderResults();
      if (preview.some((row) => row.state === "error")) {
        skipLabel.hidden = !preview.some((row) => row.change);
        errors.replaceChildren(el("p", { class: "form-error", role: "status" },
          "بعض الصفوف تحتاج مراجعة. صحّح الملف أو اختر صراحةً استيراد الصفوف الصالحة فقط."));
      }
      chooseChanges();
    } catch (error) {
      if (input.files[0] !== file) return;
      message.textContent = file.name;
      showError(error, errors);
    }
  });
  const exportButtons = (template) => ["xlsx", "csv"].map((format) => button(format.toUpperCase(), async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    try { await download(template ? [] : visible, date, format, template); }
    catch (error) { showError(error); }
    finally { control.disabled = false; }
  }, "secondary", { "aria-label": (template ? "تنزيل قالب " : "تصدير نتائج العرض ") + format.toUpperCase() }));
  const form = el("form", { class: "recruitment-editor recruitment-exchange" },
    el("div", { class: "recruitment-file-tools" },
      el("div", {}, el("strong", {}, `تصدير نتائج العرض (${number.format(visible.length)})`),
        el("div", { class: "recruitment-actions" }, exportButtons(false))),
      el("div", {}, el("strong", {}, "تنزيل قالب فارغ"),
        el("div", { class: "recruitment-actions" }, exportButtons(true)))),
    canWrite && el("label", { class: "recruitment-field recruitment-upload" },
      el("span", {}, "اختر ملفًا لمعاينته"), input, el("small", {}, "XLSX أو CSV UTF-8 · حتى ٥ ميغابايت")),
    message, errors, output,
    el("footer", { class: "modal-footer recruitment-file-footer" }, canWrite && skipLabel, button("إلغاء الأمر", closeModal), canWrite && save));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canWrite || !changes.length || pending) return;
    pending = true;
    save.disabled = input.disabled = skip.disabled = true;
    try {
      await saveBatch(state, changes);
      closeModal();
      notify(`تم حفظ ${number.format(changes.length)} عقد من الملف.`);
      await refresh();
    } catch (error) { showError(error, errors); }
    finally { pending = false; input.disabled = skip.disabled = false; chooseChanges(); }
  });
  modal(canWrite ? "معاينة واستيراد ملفات الاستقدام" : "تصدير عقود الاستقدام", form,
    { section: "ملفات الاستقدام", size: "wide", tone: "preview" });
}

function changeStatus(state, kind, rows, date, refresh, openTab) {
  const labels = { confirm: "تأكيد الوصول", archive: "أرشفة العقود", restore: "إرجاع من الأرشيف" };
  const errors = el("div");
  const input = kind === "confirm" ? el("input", { type: "date", required: true, max: date, class: "form-control" }) :
    el("textarea", { rows: 2, class: "form-control", maxlength: "4000" });
  const submit = el("button", { type: "submit", class: "primary" }, labels[kind]);
  const form = el("form", { class: "recruitment-editor" }, errors,
    el("p", {}, rows.length === 1 ? "العقد: " + rows[0].contract_number : `العقود المحددة: ${number.format(rows.length)}`),
    kind !== "restore" && el("label", { class: "recruitment-field" },
      kind === "confirm" ? "تاريخ الوصول الفعلي" : "سبب الأرشفة", input),
    el("footer", { class: "modal-footer" }, button("إغلاق", closeModal), submit));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const changes = rows.map((row) => {
        const draft = payload(row);
        if (kind === "confirm") {
          draft.arrived_on = convertField(input.value, "date");
          if (!draft.arrived_on) throw new Error("أدخل تاريخ الوصول الفعلي.");
          validateContract(draft, row, date);
        } else if (kind === "archive") {
          draft.archived_at = new Date().toISOString();
          draft.archive_reason = input.value.trim() || null;
        } else {
          draft.archived_at = draft.archive_reason = null;
          if (draft.contract_state === "cancelled") draft.contract_state = "active";
          if (draft.stage === "cancelled") draft.stage = "request";
        }
        return changesFor(row, draft);
      });
      await saveBatch(state, changes);
      openTab(contractTab(changes[0].data));
      closeModal();
      notify("تم تحديث عقود الاستقدام.");
      await refresh();
    } catch (error) { showError(error, errors); }
    finally { submit.disabled = false; }
  });
  modal(labels[kind], form, { section: "إدارة الاستقدام", size: "compact" });
}

function matches(row, filter, date) {
  if (filter.startsWith("stage:")) {
    const stage = filter.slice(6);
    return row.stage === stage || (stage === "handover" && row.stage === "completed");
  }
  const m = contractMetrics(row, date);
  const following = row.contract_state === "active";
  return {
    all: true, following, complete: row.contract_state === "completed",
    near: following && m.remaining != null && m.remaining >= 0 && m.remaining <= 10,
    late: following && m.remaining != null && m.remaining < 0,
    "no-arrival": following && !row.arrived_on && m.age >= 60,
    elapsed: following && m.age >= 45 && m.age <= 60,
    visa: row.visa_issued === true, "no-visa": row.visa_issued !== true,
    warranty: m.warranty_state === "داخل الضمان", out: m.warranty_state === "خارج الضمان",
    cancelled: row.contract_state === "cancelled", manual: row.contract_state !== "cancelled",
  }[filter];
}

function cellValue(row, column, date) {
  const [key, , format] = column;
  const value = displayValue(row, column, date);
  if (!value) return "—";
  if (key === "updated_at") return dateLabel(value);
  if (key === "warranty_remaining") return el("strong", {}, number.format(Number(value)));
  if (key === "remaining") {
    const days = Number(value);
    return badge(`${days < 0 ? "متأخر " : ""}${number.format(Math.abs(days))} يوم`,
      days < 0 ? "red" : "blue");
  }
  if (key === "warranty_state") return badge(value, value === "داخل الضمان" ? "green" : "slate");
  if (key === "visa_issued") return badge(value, row.visa_issued ? "green" : "amber");
  if (Array.isArray(format)) return badge(value, row.contract_state === "cancelled" ? "red" : "blue");
  return el("bdi", {}, value);
}

export function recruitmentView(state, refresh, user, navigate, tab = "current") {
  const date = today();
  const rows = enriched(state.data);
  const canWrite = has(state.context, "recruitment", "write");
  const selection = new Set();
  const id = state.context.organization_id + ":" + user?.id + ":" + tab;
  if (!position.has(id)) position.set(id, { filter: "all", query: "", nation: "", page: 0 });
  const prefs = position.get(id);
  const outer = el("section", { class: "recruitment" });
  const insights = el("div");
  const tableHost = el("div", { class: "recruitment-table-host" });
  const toolsHost = el("div", { class: "recruitment-actions recruitment-hero-actions" });
  const filters = el("div", { class: "recruitment-filters", "aria-label": "حالة العقود" });
  const search = el("input", { class: "form-control", type: "search", value: prefs.query,
    "aria-label": "بحث في العقود", placeholder: "بحث برقم العقد، اسم العميل، اسم العاملة، أو الجنسية…" });
  const country = el("select", { class: "form-select", "aria-label": "البلد أو الجنسية" },
    el("option", { value: "" }, "كل الجنسيات"),
    [...new Set(rows.map((row) => row.nationality).filter(Boolean))].sort((a,b) => a.localeCompare(b,"ar"))
      .map((name) => el("option", { value: name, selected: name === prefs.nation }, name)));
  if (!country.value) prefs.nation = "";
  const employees = [...new Set(rows.map((row) => row.employee_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
  if (!employees.includes(prefs.employee)) prefs.employee = "";
  const employee = el("select", { class: "form-select", "aria-label": "مسؤول المتابعة" },
    el("option", { value: "" }, "كافة مسؤولي المتابعة"),
    employees.map((name) => el("option", { value: name, selected: name === prefs.employee }, name)));
  const grouped = Object.fromEntries(recruitmentPages.map(([, , , key]) => [key, rows.filter((row) => contractTab(row) === key)]));
  const [, title] = recruitmentPages.find(([, , , key]) => key === tab);
  const openPage = (next) => {
    if (next === tab) return;
    const route = recruitmentPages.find(([, , , key]) => key === next)?.[0];
    if (route) navigate(route);
  };
  function filterBy(filter) {
    Object.assign(prefs, { filter, page: 0 });
    selection.clear();
    paint();
  }
  function count(filter) {
    return number.format(grouped.current.filter((row) => matches(row, filter, date)).length);
  }
  const stat = (label, value, action, tone = "", icon = null, note = null) => {
    const children = [icon && el("span", { class: "recruitment-stat-icon", "aria-hidden": "true" }, icon),
      el("span", { class: "recruitment-stat-label" }, label), el("strong", {}, value),
      note && el("small", {}, note)];
    return action ? button(children, action, "recruitment-stat " + tone) : el("div", { class: "recruitment-stat " + tone }, children);
  };
  const latest = rows[0];
  outer.append(
    el("header", { class: "recruitment-hero" },
      el("div", {},
        el("div", { class: "eyebrow recruitment-eyebrow" }, "إدارة الاستقدام"),
        el("h1", {}, title),
        el("p", {}, {
          current: "تابع مراحل العقود ومواعيد الوصول والتنبيهات.",
          arrived: "راجع العقود التي تم تأكيد وصولها والمدة المتبقية من الضمان.",
          archived: "راجع العقود الملغاة والمؤرشفة أو أعدها إلى القائمة المناسبة.",
        }[tab])),
      toolsHost),
    insights,
    tab === "current" && el("div", { class: "panel recruitment-monitor recruitment-updates" },
      el("div", {},
        el("h2", {}, "متابعة الأعداد والتحديثات"),
        el("div", { class: "recruitment-actions" },
          badge(`العقود الحالية: ${number.format(grouped.current.length)}`, "blue"),
          badge(`في تجربة: ${number.format(rows.filter((row) => row.trial && contractTab(row) !== "archived").length)}`, "slate"),
          badge(`عملاء لديهم حقوق: ${number.format(new Set(rows.filter((row) => row.client_rights && contractTab(row) !== "archived")
            .map((row) => row.client_id || row.employer_identity || row.employer_name).filter(Boolean)).size)}`, "slate")),
        el("small", { class: "muted" }, latest ? `آخر تحديث: ${dateLabel(latest.updated_at)} · عقد ${latest.contract_number}` : "لا توجد تحديثات مسجلة بعد")),
      has(state.context, "audit") && button("سجل التغييرات", () => navigate("audit"))),
    el("section", { class: "panel recruitment-list" },
      el("header", { class: "recruitment-monitor" },
        el("div", {}, el("h2", {}, "سجل العقود"), el("small", { class: "muted" }, "٢٠ عقدًا في الصفحة"))),
      el("div", { class: "recruitment-search" }, search, country, employee),
      filters, tableHost));

  function paint() {
    filters.replaceChildren(...filterOptions[tab].map(([key, label]) =>
      button(label, () => filterBy(key), key === prefs.filter ? "primary" : "secondary", { "aria-pressed": prefs.filter === key })));
    insights.replaceChildren(tab === "current" ? el("section", { class: "recruitment-insights" },
      el("div", { class: "recruitment-stats recruitment-overview", "aria-label": "مؤشرات الاستقدام" },
        stat("إجمالي العقود الحالية", count("all"), () => filterBy("all"), "", "▤", "عرض عقود المتابعة"),
        stat("قيد المتابعة والتنفيذ", count("following"), () => filterBy("following"), "highlight", "↻", "عرض العقود السارية"),
        stat("تجاوزت شهرين دون وصول", count("no-arrival"), () => filterBy("no-arrival"), "warning", "⚠", "عرض العقود التي تحتاج متابعة"),
        stat("مكتملة", count("complete"), () => filterBy("complete"), "", "✓", "عرض العقود المكتملة"),
        stat("المحوّلات إلى السكن", number.format(new Set(rows.filter((row) => row.housing_transferred)
          .map((row) => row.worker_id || (contractKey(row.passport_number) !== "blank" && contractKey(row.passport_number)) || row.id)).size), null, "", "⌂", "إجمالي العاملات المحوّلات")),
      el("section", { class: "panel recruitment-workflow" },
        el("h2", {}, "المسار البصري التفاعلي لمراحل الاستقدام"),
        el("p", {}, "اضغط على أي مرحلة لتصفية قائمة العقود."),
        el("div", { class: "recruitment-workflow-grid" }, workflow.map(([stage, label, icon], index) => {
          const filter = "stage:" + stage;
          const total = grouped.current.filter((row) => matches(row, filter, date)).length;
          const ratio = grouped.current.length ? Math.round(total / grouped.current.length * 100) : 0;
          const selected = prefs.filter === filter;
          return button([el("span", { class: "recruitment-workflow-meta" }, el("b", {}, number.format(index + 1)),
              el("span", { "aria-hidden": "true" }, icon)),
            el("strong", {}, label), el("small", {}, `${number.format(total)} عقد`),
            el("span", { class: "recruitment-stage-meter", "aria-hidden": "true" }, el("i", { style: `width:${ratio}%` }))],
          () => filterBy(selected ? "all" : filter), "recruitment-stage", { "aria-pressed": selected });
        }))),
      el("div", { class: "recruitment-stats small-stats" },
        [["تم التفييز", "visa"], ["لم يتم التفييز", "no-visa"], ["تنتهي خلال ١٠ أيام", "near"],
          ["تحتاج انتباه", "late"], ["مضى ٤٥–٦٠ يومًا", "elapsed"]]
          .map(([label, key]) => stat(label, count(key), () => filterBy(key)))))
      : el("div", { class: "recruitment-notice" },
        el("strong", {}, title),
        el("p", {}, tab === "arrived" ? "يبدأ الضمان من تاريخ الوصول الفعلي ويستمر ٩٠ يومًا." :
          "العقود الملغاة والمؤرشفة محفوظة هنا ويمكن إرجاعها دون حذف بياناتها.")));

    const term = contractKey(prefs.query);
    const visible = grouped[tab].filter((row) => matches(row, prefs.filter, date) &&
      (!prefs.nation || prefs.nation === row.nationality) &&
      (!prefs.employee || prefs.employee === row.employee_name) &&
      (!term || ["employer_name", "worker_name", "passport_number", "contract_number", "employer_identity", "visa_number", "nationality"]
        .some((key) => contractKey(row[key]).includes(term))));
    toolsHost.replaceChildren(
      button("↻ تحديث البيانات", refresh, "secondary"),
      button(canWrite ? "استيراد / تصدير ملفات" : "تصدير ملفات", () => exchange(state, rows, visible, date, refresh, canWrite), "secondary file-action"),
      canWrite && tab === "current" && button("+ إضافة عقد استقدام", () => editor(state, null, user, date, refresh, openPage), "primary"));
    const pages = Math.max(1, Math.ceil(visible.length / pageSize));
    prefs.page = Math.min(prefs.page, pages - 1);
    const page = visible.slice(prefs.page * pageSize, (prefs.page + 1) * pageSize);
    const selected = page.filter((row) => selection.has(row.id));
    const actions = tab === "archived" ? [["restore", "إرجاع من الأرشيف"]] :
      [...(tab === "current" ? [["confirm", "تأكيد الوصول"]] : []), ["archive", "أرشفة"]];
    const bulk = el("select", { class: "form-select", "aria-label": "إجراء جماعي" },
      el("option", { value: "" }, "اختر إجراءً جماعيًا"),
      actions.map(([key, label]) => el("option", { value: key }, label)));
    const apply = button("تطبيق على المحدد", () => changeStatus(state, bulk.value, selected, date, refresh, openPage),
      "primary", { disabled: true });
    bulk.addEventListener("change", () => { apply.disabled = !bulk.value || !selected.length; });
    const selectPage = el("input", { type: "checkbox", class: "form-check-input",
      checked: selected.length === page.length && !!page.length,
      onChange: (event) => {
        for (const row of page) event.target.checked ? selection.add(row.id) : selection.delete(row.id);
        paint();
      } });
    selectPage.indeterminate = selected.length > 0 && selected.length < page.length;
    const visibleColumns = tableKeys[tab].map(byKey);
    if (canWrite) visibleColumns.unshift(["actions", "الإجراءات"]);
    const columnClass = (key) => tab === "arrived" && key === "warranty_remaining" ? "recruitment-warranty-days" : null;
    const actionCell = (row) => el("td", {},
      el("div", { class: "recruitment-actions" },
        el("input", { type: "checkbox", class: "form-check-input", checked: selection.has(row.id),
          "aria-label": "تحديد العقد " + row.contract_number, onChange: (event) => {
            event.target.checked ? selection.add(row.id) : selection.delete(row.id);
            paint();
          } }),
        el("details", { class: "recruitment-row-actions" }, el("summary", { "aria-label": "إجراءات عقد " + row.contract_number }, "⋯"),
          button("تعديل", () => editor(state, row, user, date, refresh, openPage)),
          actions.map(([key, label]) => button(label, () => changeStatus(state, key, [row], date, refresh, openPage))))));
    const table = el("table", { class: "data-table recruitment-table" },
      el("thead", {}, el("tr", {},
        visibleColumns.map(([key, label]) => el("th", { scope: "col", class: columnClass(key) }, label)))),
      el("tbody", {}, page.map((row) => el("tr", {},
        visibleColumns.map((column) => column[0] === "actions" ? actionCell(row) :
          el("td", { class: columnClass(column[0]) }, cellValue(row, column, date))))),
        !page.length && tab === "arrived" && el("tr", {}, el("td", {
          colspan: visibleColumns.length,
        }, empty(grouped.arrived.length ? "لا توجد عقود مطابقة" : "لا توجد عقود تم تأكيد وصولها")))));
    tableHost.replaceChildren(
      canWrite && page.length ? el("div", { class: "recruitment-bulk" },
        el("label", {}, selectPage, " تحديد الصفحة"), bulk, apply, el("small", {}, `المحدد: ${number.format(selected.length)}`)) : null,
      tab === "current" && el("p", { class: "recruitment-calculation" }, "يظهر المتبقي للعقود التي لها مدة استقدام مسجلة."),
      page.length || tab === "arrived" ? el("div", { class: "table-responsive recruitment-scroll", tabindex: "0", "aria-label": "جدول عقود الاستقدام" }, table) :
        empty("لا توجد عقود مطابقة"),
      el("div", { class: "recruitment-pagination" },
        el("span", { role: "status" }, `${number.format(visible.length)} عقد · صفحة ${number.format(prefs.page + 1)} من ${number.format(pages)}`),
        button("السابق", () => { prefs.page--; selection.clear(); paint(); }, "secondary", { disabled: !prefs.page }),
        button("التالي", () => { prefs.page++; selection.clear(); paint(); }, "secondary", { disabled: prefs.page + 1 >= pages })));
  }
  search.addEventListener("input", () => { prefs.query = search.value; filterBy(prefs.filter); });
  country.addEventListener("change", () => { prefs.nation = country.value; filterBy(prefs.filter); });
  employee.addEventListener("change", () => { prefs.employee = employee.value; filterBy(prefs.filter); });
  paint();
  return outer;
}
