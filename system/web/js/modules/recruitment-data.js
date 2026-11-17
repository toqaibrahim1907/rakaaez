import { csvCell } from "./rental/reports.js";

export const requestStages = [
  ["worker_selected", "تم اختيار العاملة"],
  ["medical_passed", "اجتازت العاملة الفحص الطبي"],
  ["paperwork_fingerprint_done", "استكملت أوراقها والبصمة"],
  ["visa", "تم التفييز"],
];
export const recruitmentNationalities = ["إثيوبيا", "أوغندا", "بوروندي", "كينيا", "بنغلاديش", "الفلبين", "سريلانكا"];
export const stages = [
  ...requestStages, ["request", "الطلب"], ["cv", "اعتماد السيرة"],
  ["screening", "الفحص"], ["travel", "تذكرة الطيران"], ["arrival", "الوصول"],
  ["handover", "التسليم"], ["completed", "مكتمل"], ["cancelled", "ملغى"],
];
export const contractStates = [["active", "سار"], ["completed", "مكتمل"], ["cancelled", "ملغي"]];
export const visaStates = [["true", "تم التفييز"], ["false", "لم يتم التفييز بعد"]];

// The screen includes derived and internal fields beyond the legacy export.
export const columns = [
  ["employer_name", "اسم صاحب العمل"],
  ["contract_number", "رقم العقد"],
  ["employer_identity", "هوية صاحب العمل"],
  ["visa_number", "رقم الصادر"],
  ["occupation", "المهنة"],
  ["nationality", "الجنسية"],
  ["worker_name", "اسم العاملة"],
  ["passport_number", "رقم الجواز"],
  ["employee_name", "اسم الموظفة"],
  ["arrival_city", "مدينة الوصول"],
  ["contract_state", "حالة العقد", contractStates],
  ["opened_on", "تاريخ بداية العقد", "date"],
  ["remaining", "المتبقي", "computed"],
  ["visa_issued", "حالة التفييز", visaStates],
  ["stage", "حالة المتابعة", stages],
  ["ticket_on", "موعد التذكرة", "date"],
  ["arrived_on", "بداية الضمان (تاريخ الوصول)", "date"],
  ["warranty_end", "نهاية الضمان", "computed"],
  ["warranty_remaining", "أيام الضمان المتبقية", "computed"],
  ["warranty_state", "حالة الضمان", "computed"],
  ["notes", "ملاحظات", "textarea"],
  ["archive_reason", "سبب الأرشفة"],
  ["updated_at", "آخر تحديث", "computed"],
  ["duration_days", "مدة الاستقدام", "number"],
  ["expected_on", "الوصول المتوقع", "date"],
  ["archived_at", "تاريخ الأرشفة", "timestamp"],
  ["housing_transferred", "محولة إلى السكن", "boolean"],
  ["trial", "في تجربة", "boolean"],
  ["client_rights", "عملاء لديهم حقوق", "boolean"],
];
export const csvColumns = [
  ...columns.slice(0, 9), columns.find(([key]) => key === "duration_days"),
  ...columns.slice(9, 12), ["remaining", "المتبقي على مدة الاستقدام", "computed"],
  ...columns.slice(13, 16), ["arrived_on", "تاريخ وصول العاملة", "date"],
  columns.find(([key]) => key === "warranty_state"),
];
const dayMs = 86400000;
export function contractKey(value) {
  return String(value ?? "").trim().replace(/^'(?=[=+@-])/, "").toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0));
}
export function contractTab(row) {
  if (row.archived_at || row.contract_state === "cancelled") return "archived";
  return row.arrived_on ? "arrived" : "current";
}
export function daysBetween(start, end) {
  return (Date.parse(end) - Date.parse(start)) / dayMs;
}
export function contractMetrics(row, today) {
  const age = daysBetween(row.opened_on, today);
  const elapsedWarranty = daysBetween(row.arrived_on, today);
  const warrantyEnd = row.arrived_on ? new Date(Date.parse(row.arrived_on) + 90 * dayMs).toISOString().slice(0, 10) : null;
  return {
    age,
    remaining: row.duration_days == null || !Number.isFinite(age) ? null : row.duration_days - age,
    warranty_end: warrantyEnd,
    warranty_remaining: warrantyEnd ? Math.max(0, 90 - elapsedWarranty) : null,
    warranty_state: !warrantyEnd ? "لم يتم تأكيد الوصول" : elapsedWarranty < 0 ? "لم يبدأ الضمان" :
      elapsedWarranty < 90 ? "داخل الضمان" : "خارج الضمان",
  };
}
export function displayValue(row, [key, , format], today) {
  const value = key === "updated_at" || format !== "computed" ? row[key] : contractMetrics(row, today)[key];
  if (value == null || value === "") return "";
  if (Array.isArray(format)) return format.find(([code]) => code === String(value))?.[1] || String(value);
  if (format === "boolean") return value ? "نعم" : "لا";
  return String(value);
}
export function recruitmentMatrix(rows, today) {
  return [csvColumns.map(([, label]) => label),
    ...rows.map((row) => csvColumns.map((column) => {
      if (column[0] === "stage" && row.stage === "request") return "";
      if (column[0] === "warranty_state" && contractMetrics(row, today).warranty_state === "داخل الضمان") return "في فترة الضمان";
      return displayValue(row, column, today);
    }))];
}
export function exportRecruitment(rows, today) {
  return "\uFEFF" + recruitmentMatrix(rows, today).map((line) => line.map(csvCell).join(",")).join("\r\n");
}

export function readCsv(input) {
  const source = input.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes(",") ? "," : firstLine.includes(";") ? ";" : ",";
  const rows = [];
  let row = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === delimiter || char === "\r" || char === "\n") {
      row.push(cell);
      cell = "";
      closed = false;
      if (char !== delimiter) {
        if (char === "\r" && source[i + 1] === "\n") i++;
        rows.push(row);
        row = [];
      }
    } else if (char === '"' && !cell && !closed) {
      quoted = true;
    } else if (char === '"' || closed) {
      throw new Error("علامات الاقتباس غير صحيحة في CSV.");
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("يوجد حقل مقتبس غير مغلق في CSV.");
  if (cell || row.length || closed) rows.push([...row, cell]);
  return rows;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}
function normalizeDate(value) {
  if (validDate(value)) return value;
  const yearFirst = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(value);
  const yearLast = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (yearFirst) {
    const [, year, month, day] = yearFirst;
    return [year, month.padStart(2, "0"), day.padStart(2, "0")].join("-");
  }
  if (yearLast) {
    const [, first, second, year] = yearLast;
    if (+first <= 12 && +second <= 12 && +first !== +second)
      throw new Error("ترتيب اليوم والشهر غير واضح. أدخل التاريخ بصيغة YYYY-MM-DD.");
    const [month, day] = +first > 12 ? [second, first] : [first, second];
    return [year, month.padStart(2, "0"), day.padStart(2, "0")].join("-");
  }
  return value;
}
export function convertField(raw, format, csvEscaped = false) {
  const value = csvEscaped ? raw.trim().replace(/^'(?=[\s]*[=+@-])/, "") : raw.trim();
  if (!value) return null;
  if (value.length > 4000) throw new Error("القيمة طويلة جدًا.");
  if (format === "date") {
    const date = normalizeDate(contractKey(value.replace(/[\u200e\u200f\u061c]/g, "")));
    if (!validDate(date)) throw new Error("استخدم تاريخًا صالحًا بصيغة YYYY-MM-DD.");
    return date;
  }
  if (format === "timestamp" && (!validDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))))
    throw new Error("تاريخ الأرشفة غير صالح.");
  if (format === "number") {
    const n = Number(contractKey(value));
    if (!/^\d+$/.test(contractKey(value)) || !Number.isInteger(n) || n < 1 || n > 3650)
      throw new Error("مدة الاستقدام يجب أن تكون من 1 إلى 3650 يومًا.");
    return n;
  }
  if (format === "boolean") {
    if (["نعم", "true", "1"].includes(value)) return true;
    if (["لا", "false", "0"].includes(value)) return false;
    throw new Error("القيمة يجب أن تكون نعم أو لا.");
  }
  if (Array.isArray(format)) {
    const alias = format === contractStates && value === "ملغى" ? "cancelled" :
      format === stages && value === "إصدار التأشيرة" ? "visa" : value;
    const choice = format.find(([code, label]) => code === alias || label === alias);
    if (!choice) throw new Error("الحالة غير معروفة.");
    if (format === visaStates) return choice[0] === "true";
    return choice[0];
  }
  return value;
}
export function validateContract(data, previous, today) {
  if (!contractKey(data.contract_number) || data.contract_number.length > 100) throw new Error("رقم العقد مطلوب (حتى 100 حرف).");
  if (!data.employer_name && !previous?.client_id) throw new Error("اسم صاحب العمل مطلوب.");
  if (!previous && (!data.worker_name || !data.passport_number)) throw new Error("اسم العاملة ورقم الجواز مطلوبان.");
  if (!data.opened_on) throw new Error("تاريخ بداية العقد مطلوب.");
  if (data.arrived_on && (data.arrived_on < data.opened_on || data.arrived_on > today))
    throw new Error("تاريخ الوصول يجب أن يقع بين بداية العقد واليوم.");
}
export const editableColumns = columns.filter(([, , format]) => format !== "computed");
export function payload(row) {
  return Object.fromEntries(editableColumns.map(([key, , format]) =>
    [key, row[key] ?? (format === "boolean" ? false : key === "stage" ? "request" : key === "contract_state" ? "active" : null)]));
}

export function previewRecruitment(input, existing, today) {
  return previewRecruitmentRows(readCsv(input), existing, today, new Map(), true);
}
export function recruitmentSchema(header) {
  const schema = header?.map((label) => [...csvColumns, ...columns].find((column) => column[1] === label.trim()));
  return schema?.every(Boolean) && schema.some(([key]) => key === "contract_number") &&
    new Set(schema.map(([key]) => key)).size === schema.length ? schema : null;
}
export function previewRecruitmentRows([header, ...body], existing, today, rowErrors = new Map(), csvEscaped = false) {
  if (!header) throw new Error("الملف فارغ.");
  const schema = recruitmentSchema(header);
  if (!schema) throw new Error("عناوين الملف غير متوافقة أو مكررة. نزّل القالب من القسم.");
  const byNumber = new Map(existing.map((row) => [contractKey(row.contract_number), row]));
  const numberIndex = schema.findIndex(([key]) => key === "contract_number");
  const records = body.map((cells, index) => ({ cells, line: index + 2 }))
    .filter(({ cells, line }) => rowErrors.has(line) || cells.some((cell) => cell.trim()));
  if (!records.length || records.length > 2000) throw new Error("اختر ملفًا يحتوي من 1 إلى 2000 عقد.");
  const occurrences = new Map();
  for (const { cells } of records) {
    const key = contractKey(cells[numberIndex]);
    occurrences.set(key, (occurrences.get(key) || 0) + 1);
  }
  return records.map(({ cells, line }) => {
    const number = cells[numberIndex] || "";
    const key = contractKey(number);
    const previous = byNumber.get(key);
    try {
      if (key && occurrences.get(key) > 1)
        return { line, number, state: "error", duplicate: true, error: "رقم العقد مكرر داخل الملف." };
      if (rowErrors.has(line)) throw new Error(rowErrors.get(line));
      if (cells.length !== schema.length) throw new Error("عدد القيم يختلف عن عدد الأعمدة.");
      const data = payload(previous || {});
      let exportedAt;
      schema.forEach(([field, label, format], index) => {
        if (field === "updated_at") exportedAt = cells[index].trim();
        if (format === "computed") return;
        try {
          data[field] = convertField(cells[index], format, csvEscaped);
          if (format === "boolean" && data[field] == null) data[field] = false;
        } catch (error) { throw new Error(label + ": " + error.message); }
      });
      if (previous) data.contract_number = previous.contract_number;
      data.stage ||= "request";
      data.contract_state ||= "active";
      const summary = { employer: data.employer_name, worker: data.worker_name, stage: displayValue(data, columns.find(([field]) => field === "stage"), today) };
      if (previous && JSON.stringify(payload(previous)) === JSON.stringify(data)) return { line, number, state: "unchanged", ...summary };
      if (previous && exportedAt && exportedAt !== previous.updated_at)
        throw new Error("العقد تغير منذ تصدير الملف. نزّل نسخة حديثة.");
      validateContract(data, previous, today);
      const before = previous && payload(previous);
      const fields = before ? editableColumns.filter(([field]) => before[field] !== data[field]) : [];
      return { line, number, state: previous ? "update" : "insert", ...summary,
        fields: fields.map(([, label]) => label), change: { id: previous?.id, version: previous?.version, data } };
    } catch (error) {
      return { line, number, state: "error", error: error.message };
    }
  });
}
