import { el, button, hint, showError, notify } from "./dom.js";
import { modal, closeModal } from "./modal.js";
import { models } from "../data/model.js";
import { saveRecord } from "../data/repository.js";
export function fieldInput(field, state, value) {
  let input;
  if (field.type === "select") {
    input = el(
      "select",
      { name: field.key, required: field.required },
      el("option", { value: "" }, "اختر..."),
    );
    let options =
      field.options ||
      (state.data[field.ref] || [])
        .filter((row) => row.is_active !== false || row.id === value)
        .map((row) => [row.id, row.label || row.name || row.contract_number]);
    for (const [id, label] of options)
      input.append(el("option", { value: id }, label));
  } else if (field.type === "textarea")
    input = el("textarea", { name: field.key, rows: 3, maxlength: 4000 });
  else
    input = el("input", {
      name: field.key,
      type: field.type === "money" ? "number" : field.type || "text",
      required: field.required,
      min: field.type === "number" || field.type === "money" ? 0 : null,
      step:
        field.type === "money" ? "0.01" : field.type === "number" ? "1" : null,
      maxlength: field.type === "text" ? 200 : null,
    });
  input.value = value ?? "";
  return el(
    "label",
    { class: field.type === "textarea" ? "wide" : "" },
    field.label + (field.required ? " *" : ""),
    input,
  );
}
export function recordForm(state, kind, row, refresh, extra = {}) {
  const model = models[kind];
  const grid = el(
    "div",
    { class: "form-grid" },
    model.fields.map((field) => fieldInput(field, state, row?.[field.key])),
  );
  const errors = el("div");
  const submit = el(
    "button",
    { class: "primary", type: "submit" },
    "حفظ السجل",
  );
  const form = el(
    "form",
    {},
    errors,
    grid,
    ...(kind === "contracts"
      ? [hint("التواريخ والحالة تُحفظ كما تدخلها. لا يتم تغييرها تلقائياً.")]
      : kind === "salaries"
        ? [hint("استحقاق يدوي فقط. قواعد الاحتساب والدفع لم تُعتمد بعد.")]
        : []),
    el(
      "footer",
      { class: "modal-footer" },
      submit,
      button("إلغاء", closeModal),
    ),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const values = new FormData(form);
      const data = { ...extra };
      for (const field of model.fields) {
        const value = values.get(field.key);
        data[field.key] =
          value === ""
            ? null
            : field.type === "number"
              ? Number(value)
              : String(value).trim();
      }
      if (kind === "contracts" && data.end_date < data.start_date)
        throw new Error("تاريخ نهاية العقد يسبق بدايته");
      if (kind === "evaluations" && data.contract_id) {
        const contract = state.data.contracts?.find(
          (c) => c.id === data.contract_id,
        );
        if (contract && contract.worker_id !== data.worker_id)
          throw new Error("اختر عقداً لنفس العاملة");
      }
      await saveRecord(state, kind, data, row);
      closeModal();
      notify("تم حفظ السجل");
      await refresh();
    } catch (error) {
      showError(error, errors);
    } finally {
      submit.disabled = false;
    }
  });
  modal((row ? "تعديل · " : "إضافة · ") + model.title, form);
}
