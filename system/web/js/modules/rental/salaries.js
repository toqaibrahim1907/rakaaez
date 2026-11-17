import { crudView } from "./crud.js";
import {
  el,
  button,
  hint,
  today,
  money,
  showError,
  notify,
} from "../../components/dom.js";
import { modal, closeModal } from "../../components/modal.js";
import { checked } from "../../data/repository.js";
import { client } from "../../supabase-client.js";
import { has } from "../../permissions.js";
export function paymentForm(state, row, refresh) {
  const submission = crypto.randomUUID();
  const errors = el("div");
  const amount = el("input", {
    name: "amount",
    type: "number",
    min: "0.01",
    step: "0.01",
    required: true,
  });
  const date = el("input", {
    name: "payment_date",
    type: "date",
    required: true,
    value: today(),
  });
  const reference = el("input", { name: "reference", maxlength: 200 });
  const submit = el(
    "button",
    { class: "primary", type: "submit" },
    "حفظ الدفعة",
  );
  const form = el(
    "form",
    {},
    errors,
    el(
      "div",
      { class: "form-grid" },
      el("label", {}, "المبلغ", amount),
      el("label", {}, "تاريخ الدفع", date),
      el("label", { class: "wide" }, "مرجع الدفع", reference),
    ),
    hint(
      "سجل الدفعات محفوظ للمراجعة. أدخل فقط دفعة معتمدة؛ لا توجد قواعد تلقائية لاحتساب الراتب أو لتصحيح الدفعات.",
    ),
    el("footer", { class: "modal-footer" }, button("إلغاء", closeModal), submit),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const result = await client
        .from("rental_salary_payments")
        .insert({
          organization_id: state.context.organization_id,
          salary_record_id: row.id,
          amount: amount.value,
          currency: row.currency,
          payment_date: date.value,
          reference: reference.value.trim(),
          submission_id: submission,
        });
      if (result.error && result.error.code !== "23505") throw result.error;
      closeModal();
      notify("تم تسجيل الدفعة");
      await refresh();
    } catch (error) {
      showError(error, errors);
    } finally {
      submit.disabled = false;
    }
  });
  modal("تسجيل دفعة · " + row.period_label, form, { section: "الرواتب", size: "compact" });
}
export function paymentHistory(state, row) {
  const payments = (state.data.payments || []).filter(
    (p) => p.salary_record_id === row.id,
  );
  modal(
    "سجل الدفعات",
    el(
      "div",
      { class: "payment-list" },
      payments.length
        ? payments.map((p) =>
            el(
              "div",
              { class: "payment-item" },
              el("strong", {}, money(p.amount, p.currency)),
              el("div", {}, p.payment_date),
              el("small", {}, p.reference || "بدون مرجع"),
              el("div", { class: "small-note" }, "معرّف السجل: " + p.id),
            ),
          )
        : hint("لم تُسجل دفعات لهذا الاستحقاق."),
    ),
  );
}
export const salariesView = (state, refresh) =>
  crudView(state, "salaries", refresh, {
    message:
      "المستحقات مدخلة يدوياً. المتبقي هو المبلغ المسجل ناقص الدفعات فقط، وليس احتساباً تلقائياً للراتب.",
    extraActions: (row) => [
      button("سجل الدفع", () => paymentHistory(state, row), "small-button"),
      ...(has(state.context, "salaries", "write")
        ? [
            button(
              "تسجيل دفعة",
              () => paymentForm(state, row, refresh),
              "small-button",
            ),
          ]
        : []),
    ],
  });
