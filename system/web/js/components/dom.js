export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "checked" || key === "disabled" || key === "required")
      node[key] = Boolean(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity))
    if (child !== null && child !== undefined && child !== false)
      node.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  return node;
}
export const button = (label, click, className = "secondary", attrs = {}) =>
  el(
    "button",
    { type: "button", class: className, onClick: click, ...attrs },
    label,
  );
export function notify(message, danger = false) {
  const node = el(
    "div",
    {
      class: `alert ${danger ? "alert-danger" : "alert-success"} shadow-sm`,
      role: "status",
    },
    message,
  );
  document.querySelector("#notifications").append(node);
  setTimeout(() => node.remove(), 7000);
}
export function showError(error, target) {
  console.error(error);
  const messages = {
    42501: "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
    23503: "هذا السجل مرتبط ببيانات أخرى. راجع السجلات المرتبطة قبل حذفه.",
    23505: "السجل موجود مسبقاً أو تم إرسال الطلب سابقاً.",
    23514: "إحدى القيم لا تطابق قواعد البيانات المطلوبة.",
  };
  const text = messages[error.code] || error.message || "تعذر إكمال العملية";
  if (target) {
    target.replaceChildren(
      el("div", { class: "form-error", role: "alert" }, text),
    );
  } else notify(text, true);
}
export const money = (value, currency = "SAR") =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency }).format(
    Number(value || 0),
  );
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        calendar: "gregory",
      }).format(new Date(value))
    : "—";
export const daysUntil = (value) =>
  Math.round(
    (Date.parse(value + "T00:00:00Z") - Date.parse(today() + "T00:00:00Z")) /
      86400000,
  );
export const hint = (text) => el("p", { class: "hint" }, text);
export function badge(label, tone = "slate") {
  return el("span", { class: "badge " + tone }, label || "—");
}
export function empty(message = "لا توجد سجلات لعرضها") {
  return el(
    "div",
    { class: "empty" },
    el("span", {}, "▤"),
    el("h3", {}, message),
    el("p", {}, "أضف سجلاً جديداً أو غيّر عوامل التصفية."),
  );
}
