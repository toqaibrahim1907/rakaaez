const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
export const models = {
  recruitment: {
    table: "operations_recruitment",
    title: "عقود ومراحل الاستقدام",
    name: "عقد استقدام",
    permission: "recruitment",
    fields: [
      f("contract_number", "رقم العقد", "text", { required: true }),
      f("client_id", "العميل", "select", { required: true, ref: "clients" }),
      f("worker_id", "العاملة", "select", { ref: "workers" }),
      f("stage", "المرحلة", "select", { required: true, options: [["request","الطلب"],["visa","إصدار التأشيرة"],["cv","اعتماد السيرة"],["screening","الفحص"],["travel","تذكرة الطيران"],["arrival","الوصول"],["handover","التسليم"],["completed","مكتمل"],["cancelled","ملغى"]] }),
      f("opened_on", "تاريخ الفتح", "date", { required: true }),
      f("expected_on", "الوصول المتوقع", "date"),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: ["contract_number","client_id","worker_id","stage","opened_on","expected_on"],
  },
  housing: {
    table: "operations_housing",
    title: "السكن والحركات التشغيلية",
    name: "تسجيل دخول للسكن",
    permission: "housing",
    fields: [
      f("worker_id", "العاملة", "select", { required: true, ref: "workers" }),
      f("location", "المبنى أو الغرفة", "text", { required: true }),
      f("reason", "سبب الإقامة", "select", { required: true, options: [["available","متاحة للتأجير"],["travel","بانتظار السفر"],["transfer","نقل الخدمات"],["other","أخرى"]] }),
      f("entered_on", "تاريخ الدخول", "date", { required: true }),
      f("left_on", "تاريخ المغادرة", "date"),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: ["worker_id","location","reason","entered_on","left_on"],
  },
  employees: {
    table: "operations_employees",
    title: "الموظفون",
    name: "موظف",
    permission: "employees",
    fields: [
      f("name", "الاسم", "text", { required: true }),
      f("job_title", "المسمى الوظيفي", "text", { required: true }),
      f("department", "القسم", "text", { required: true }),
      f("hired_on", "تاريخ التعيين", "date", { required: true }),
      f("status", "الحالة", "select", { required: true, options: [["active","نشط"],["inactive","غير نشط"]] }),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: ["name","job_title","department","hired_on","status"],
  },
  leaves: {
    table: "operations_leaves",
    title: "طلبات الإجازة",
    name: "طلب إجازة",
    permission: "leaves",
    fields: [
      f("employee_id", "الموظف", "select", { required: true, ref: "employees" }),
      f("leave_type", "نوع الإجازة", "text", { required: true }),
      f("start_on", "من تاريخ", "date", { required: true }),
      f("end_on", "إلى تاريخ", "date", { required: true }),
      f("status", "الحالة", "select", { required: true, options: [["pending","بانتظار القرار"],["approved","مقبول"],["rejected","مرفوض"]] }),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: ["employee_id","leave_type","start_on","end_on","status"],
  },
  complaints: {
    table: "operations_complaints",
    title: "الشكاوى والبلاغات",
    name: "شكوى",
    permission: "complaints",
    fields: [
      f("client_id", "العميل", "select", { required: true, ref: "clients" }),
      f("subject", "الموضوع", "text", { required: true }),
      f("received_on", "تاريخ الاستلام", "date", { required: true }),
      f("status", "الحالة", "select", { required: true, options: [["new","جديدة"],["working","قيد المعالجة"],["resolved","محلولة"],["closed","مغلقة"]] }),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: ["client_id","subject","received_on","status"],
  },
  requests: {
    table: "operations_requests",
    title: "طلبات العملاء",
    name: "طلب عميل",
    permission: "requests",
    fields: [
      f("client_id", "العميل", "select", { required: true, ref: "clients" }),
      f("service", "الخدمة", "select", { required: true, options: [["rental","التأجير"],["recruitment","الاستقدام"],["other","أخرى"]] }),
      f("received_on", "تاريخ الاستلام", "date", { required: true }),
      f("status", "الحالة", "select", { required: true, options: [["new","جديد"],["working","قيد المعالجة"],["completed","مكتمل"],["cancelled","ملغى"]] }),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: ["client_id","service","received_on","status"],
  },
  workers: {
    table: "rental_workers",
    title: "العاملات",
    name: "عاملة",
    permission: "workers",
    fields: [
      f("name", "اسم العاملة", "text", { required: true }),
      f("nationality", "الجنسية", "text", { required: true }),
      f("availability_status_id", "الحالة", "select", {
        ref: "worker_statuses",
        required: true,
      }),
      f("arrival_date", "تاريخ الوصول", "date"),
      f("gender", "الجنس"),
      f("religion", "الديانة"),
      f("age", "العمر", "number"),
      f("occupation", "المهنة"),
      f("experience", "الخبرة"),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: [
      "name",
      "nationality",
      "availability_status_id",
      "arrival_date",
      "occupation",
    ],
  },
  workers_private: {
    table: "rental_worker_private",
    title: "بيانات العاملة الخاصة",
    permission: "workers_private",
    fields: [
      f("residency_number", "رقم الإقامة"),
      f("passport_number", "رقم الجواز"),
      f("border_number", "رقم الحدود"),
      f("phone", "رقم الجوال"),
      f("iban", "رقم الآيبان"),
      f("insurance_expiry", "انتهاء التأمين الطبي", "date"),
      f("reference_salary", "الراتب المرجعي (لا ينشئ مستحقات)", "money"),
      f("recruitment_cost", "سعر الاستقدام", "money"),
    ],
    columns: [
      "residency_number",
      "passport_number",
      "phone",
      "insurance_expiry",
    ],
  },
  clients: {
    table: "rental_clients",
    title: "العملاء",
    name: "عميل",
    permission: "clients",
    fields: [
      f("name", "اسم العميل", "text", { required: true }),
      f("city", "المدينة"),
    ],
    columns: ["name", "city"],
  },
  clients_private: {
    table: "rental_client_private",
    title: "بيانات العميل الخاصة",
    permission: "clients_private",
    fields: [f("phone", "رقم الجوال"), f("identity_number", "رقم الهوية")],
    columns: ["phone", "identity_number"],
  },
  contracts: {
    table: "rental_contracts",
    title: "العقود",
    name: "عقد",
    permission: "contracts",
    fields: [
      f("contract_number", "رقم العقد", "text", { required: true }),
      f("client_id", "العميل", "select", { ref: "clients", required: true }),
      f("worker_id", "العاملة", "select", { ref: "workers", required: true }),
      f("start_date", "تاريخ البداية", "date", { required: true }),
      f("end_date", "تاريخ النهاية", "date", { required: true }),
      f("package_days", "أيام الباقة (يدوي)", "number"),
      f("amount", "مبلغ العقد", "money", { required: true }),
      f("status_id", "الحالة", "select", {
        ref: "contract_statuses",
        required: true,
      }),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: [
      "contract_number",
      "client_id",
      "worker_id",
      "start_date",
      "end_date",
      "amount",
      "status_id",
    ],
  },
  salaries: {
    table: "rental_salary_records",
    title: "الرواتب",
    name: "استحقاق راتب",
    permission: "salaries",
    fields: [
      f("worker_id", "العاملة", "select", { ref: "workers", required: true }),
      f("period_label", "الفترة / الشهر", "text", { required: true }),
      f("due_date", "تاريخ الاستحقاق", "date", { required: true }),
      f("amount", "المبلغ المستحق (يدوي)", "money", { required: true }),
      f("administrative_state", "الحالة الإدارية", "select", {
        options: [
          ["open", "مفتوح"],
          ["stopped", "موقوف"],
        ],
        required: true,
      }),
      f("notes", "ملاحظات", "textarea"),
    ],
    columns: [
      "worker_id",
      "period_label",
      "due_date",
      "amount",
      "administrative_state",
    ],
  },
  evaluations: {
    table: "rental_worker_evaluations",
    title: "تقييم العاملات",
    name: "تقييم",
    permission: "evaluations",
    fields: [
      f("worker_id", "العاملة", "select", { ref: "workers", required: true }),
      f("contract_id", "العقد (اختياري)", "select", { ref: "contracts" }),
      f("evaluation_date", "تاريخ التقييم", "date", { required: true }),
      f("assessment", "التقييم / التصنيف", "text", { required: true }),
      f("work_days", "أيام العمل الموثقة (يدوي)", "number"),
      f("notes", "ملاحظات المدير", "textarea"),
    ],
    columns: [
      "worker_id",
      "evaluation_date",
      "assessment",
      "work_days",
      "notes",
    ],
  },
};
export const dateKeys = {
  recruitment: "opened_on",
  housing: "entered_on",
  employees: "hired_on",
  leaves: "start_on",
  complaints: "received_on",
  requests: "received_on",
  workers: "created_at",
  clients: "created_at",
  contracts: "start_date",
  salaries: "due_date",
  evaluations: "evaluation_date",
};
export function cents(value) {
  const text = String(value ?? 0);
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error("قيمة نقدية غير صحيحة");
  return (
    (match[1] ? -1n : 1n) *
    (BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0")))
  );
}
export function paymentBalance(state, row) {
  const total = (state.data.payments || [])
    .filter((p) => p.salary_record_id === row.id)
    .reduce((sum, p) => sum + cents(p.amount), 0n);
  return { paid: total, remaining: cents(row.amount) - total };
}
export function moneyCents(value, currency = "SAR") {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const fraction = String(absolute % 100n)
    .padStart(2, "0")
    .replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
  return `${negative ? "-" : ""}${(absolute / 100n).toLocaleString("ar-EG")}٫${fraction} ${currency === "SAR" ? "ر.س" : currency}`;
}
export function paymentState(state, row) {
  const balance = paymentBalance(state, row);
  return balance.remaining < 0n
    ? "دفعات زائدة"
    : balance.remaining === 0n
      ? "مدفوع"
      : balance.paid > 0n
        ? "جزئي"
        : "غير مدفوع";
}
export function groupedMoney(rows, amount) {
  const totals = new Map();
  for (const row of rows) {
    const currency = row.currency || "SAR";
    totals.set(currency, (totals.get(currency) || 0n) + amount(row));
  }
  return totals.size
    ? [...totals]
        .map(([currency, value]) => moneyCents(value, currency))
        .join(" / ")
    : moneyCents(0n);
}
