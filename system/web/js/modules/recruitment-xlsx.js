import { read, utils, write, SSF } from "../../assets/vendor/sheetjs-0.20.3.mjs";
import { csvColumns, recruitmentMatrix, recruitmentSchema } from "./recruitment-data.js";

const sheetName = "Sheet9";
const rowLimit = 5000;
const identifiers = new Set(["contract_number", "employer_identity", "visa_number", "passport_number"]);
const formatError = () => new Error("تعذرت قراءة ملف XLSX. استخدم ملف Excel سليمًا وغير محمي.");

// Reject oversized or encrypted ZIP containers before handing them to the reader.
function checkContainer(bytes) {
  const zip = new DataView(bytes);
  if (zip.byteLength < 22 || zip.getUint32(0, true) !== 0x04034b50) throw formatError();
  let end = zip.byteLength - 22;
  for (; end >= Math.max(0, zip.byteLength - 65557); end--) {
    if (zip.getUint32(end, true) === 0x06054b50 && end + 22 + zip.getUint16(end + 20, true) === zip.byteLength) break;
  }
  if (end < Math.max(0, zip.byteLength - 65557)) throw formatError();
  const count = zip.getUint16(end + 10, true);
  const directory = zip.getUint32(end + 16, true);
  if (!count || count > 1024 || directory + zip.getUint32(end + 12, true) !== end) throw formatError();
  let offset = directory, inflated = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || zip.getUint32(offset, true) !== 0x02014b50 ||
      (zip.getUint16(offset + 8, true) & 1)) throw formatError();
    inflated += zip.getUint32(offset + 24, true);
    if (inflated > 64_000_000) throw new Error("ملف Excel كبير بعد فك الضغط. استخدم نسخة أصغر.");
    offset += 46 + zip.getUint16(offset + 28, true) + zip.getUint16(offset + 30, true) + zip.getUint16(offset + 32, true);
  }
  if (offset !== end) throw formatError();
}

function headerOf(sheet) {
  if (!sheet?.["!ref"]) return [];
  const end = utils.decode_range(sheet["!ref"]).e.c;
  if (end >= 64) return [];
  const cells = Array.from({ length: end + 1 }, (_, c) => String(sheet[utils.encode_cell({ r: 0, c })]?.v ?? "").trim());
  while (cells.at(-1) === "") cells.pop();
  return cells;
}

export function readRecruitmentWorkbook(bytes) {
  checkContainer(bytes);
  let book;
  const options = { type: "array", cellHTML: false, cellNF: true, cellText: false, WTF: true };
  try {
    book = read(bytes, { ...options, sheetRows: 1 });
  } catch { throw formatError(); }
  const candidates = book.SheetNames.map((name) => {
    const header = headerOf(book.Sheets[name]);
    return { name, header, schema: recruitmentSchema(header) };
  }).filter(({ schema }) => schema);
  const exact = candidates.filter(({ header }) => header.length === csvColumns.length &&
    csvColumns.every(([, label]) => header.includes(label)));
  const selected = exact.find(({ name }) => name === sheetName) || (exact.length === 1 ? exact[0] : null) ||
    (!exact.length && candidates.length === 1 ? candidates[0] : null);
  if (!selected) throw new Error(candidates.length > 1 ? "يوجد أكثر من ورقة عقود مطابقة. احتفظ بورقة واحدة أو استخدم Sheet9 بالقالب الكامل." :
    "لم نجد ورقة بعناوين عقود الاستقدام. نزّل قالب Excel من القسم.");
  try {
    book = read(bytes, { ...options, sheetRows: rowLimit + 1, sheets: selected.name });
  } catch { throw formatError(); }
  const sheet = book.Sheets[selected.name];
  const end = utils.decode_range(sheet["!fullref"] || sheet["!ref"]).e;
  if (end.r >= rowLimit || end.c >= 64) throw new Error("ورقة العقود تتجاوز حجم القالب المدعوم. قسّم الملف.");
  const errors = new Map();
  const matrix = [selected.header];
  const date1904 = !!book.Workbook?.WBProps?.date1904;
  for (let r = 1; r <= end.r; r++) {
    const issues = [];
    const values = selected.schema.map(([key, label, format], c) => {
      if (format === "computed") return "";
      const cell = sheet[utils.encode_cell({ r, c })];
      if (!cell) return "";
      // Excel stores lookup results alongside formulas. Read the cached value,
      // never evaluate formulas or fetch external workbook links.
      if (cell.t === "e" || ((cell.f || cell.F) && (cell.v == null || cell.t === "z"))) {
        issues.push(label + ": لا توجد نتيجة Excel صالحة محفوظة. راجع القيمة واحفظ الملف من جديد.");
        return "";
      }
      if (cell.t === "z") return "";
      if (cell.t === "n" && format === "date") {
        const day = SSF.parse_date_code(cell.v, { date1904 });
        if (!day || (!SSF.is_date(cell.z || "") && (cell.v < 20000 || cell.v > 100000))) {
          issues.push(label + ": تاريخ Excel غير صالح.");
          return "";
        }
        return [day.y, day.m, day.d].map((part, index) => String(part).padStart(index ? 2 : 4, "0")).join("-");
      }
      if (cell.t === "n" && identifiers.has(key)) {
        if (!Number.isSafeInteger(cell.v) || Math.abs(cell.v) >= 1e15) {
          issues.push(label + ": احفظ المعرّف كنص لتفادي فقد الأرقام في Excel.");
          return "";
        }
        if (/^0+$/.test(cell.z || "")) return String(cell.v).padStart(cell.z.length, "0");
      }
      return String(cell.v ?? "");
    });
    for (let c = selected.schema.length; c <= end.c; c++) {
      const cell = sheet[utils.encode_cell({ r, c })];
      if (cell?.f || String(cell?.v ?? "").trim()) { issues.push("توجد بيانات في عمود بلا عنوان."); break; }
    }
    if (issues.length) errors.set(r + 1, issues.join(" "));
    matrix.push(values);
  }
  return { matrix, errors, sheet: selected.name };
}

export function exportRecruitmentWorkbook(rows, today) {
  const sheet = utils.aoa_to_sheet(recruitmentMatrix(rows, today));
  sheet["!cols"] = csvColumns.map(([key, label]) => ({ wch: Math.max(label.length + 4, identifiers.has(key) ? 20 : 16) }));
  sheet["!autofilter"] = { ref: sheet["!ref"] };
  const book = utils.book_new();
  book.Workbook = { Views: [{ RTL: true }] };
  utils.book_append_sheet(book, sheet, sheetName);
  return write(book, { type: "array", bookType: "xlsx", compression: true });
}
