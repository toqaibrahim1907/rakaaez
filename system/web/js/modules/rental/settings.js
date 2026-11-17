import { el, button, hint, showError, notify } from "../../components/dom.js";
import { modal, closeModal } from "../../components/modal.js";
import { saveSettings, checked } from "../../data/repository.js";
import { client } from "../../supabase-client.js";
function statusForm(state, refresh, row) {
  const code = el("input", {
    name: "code",
    required: true,
    pattern: "[a-z][a-z0-9_-]{1,40}",
    dir: "ltr",
    value: row?.code || "",
    disabled: Boolean(row),
  });
  const label = el("input", {
    name: "label",
    required: true,
    maxlength: 80,
    value: row?.label || "",
  });
  const active = el("input", {
    name: "active",
    type: "checkbox",
    checked: row ? row.is_active : true,
  });
  const errors = el("div");
  const submit = el(
    "button",
    { type: "submit", class: "primary" },
    "حفظ الحالة",
  );
  const form = el(
    "form",
    {},
    errors,
    el(
      "div",
      { class: "form-grid" },
      el("label", {}, "المعرّف الثابت (إنجليزي)", code),
      el("label", {}, "اسم الحالة", label),
      el("label", { class: "checkbox" }, active, "متاحة للعقود الجديدة"),
    ),
    hint(
      "تغيير الاسم أو إيقاف الحالة لا يغيّر تواريخ العقود أو حالاتها المسجلة.",
    ),
    el("footer", { class: "modal-footer" }, button("إلغاء", closeModal), submit),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const data = { label: label.value.trim(), is_active: active.checked };
      if (row)
        await checked(
          client
            .from("rental_contract_statuses")
            .update(data)
            .eq("organization_id", state.context.organization_id)
            .eq("id", row.id),
        );
      else
        await checked(
          client
            .from("rental_contract_statuses")
            .insert({
              ...data,
              code: code.value.trim(),
              organization_id: state.context.organization_id,
            }),
        );
      closeModal();
      await refresh();
      notify("تم حفظ الحالة");
    } catch (error) {
      showError(error, errors);
    } finally {
      submit.disabled = false;
    }
  });
  modal("إعداد حالة عقد", form, { section: "الإعدادات", size: "compact" });
}
export function settingsView(state, refresh) {
  const previous = state.data.settings?.[0];
  const days = el("input", {
    name: "soon_days",
    type: "number",
    required: true,
    min: 0,
    max: 365,
    value: previous?.soon_days ?? 7,
  });
  const notes = el(
    "textarea",
    { rows: 4, name: "salary_policy_notes" },
    previous?.salary_policy_notes || "",
  );
  const errors = el("div");
  const submit = el(
    "button",
    { type: "submit", class: "primary" },
    "حفظ الإعدادات",
  );
  const form = el(
    "form",
    { class: "panel settings-panel" },
    el("div", { class: "panel-heading" }, el("h2", {}, "قواعد العرض والإدخال")),
    errors,
    el(
      "div",
      { class: "form-grid" },
      el("label", {}, "نافذة عرض العقود القريبة من الانتهاء (أيام)", days),
      el(
        "label",
        {},
        "ملاحظات مسودة قواعد الرواتب (لا تُطبّق تلقائياً)",
        notes,
      ),
    ),
    el(
      "div",
      { class: "info-banner" },
      el(
        "div",
        {},
        el("strong", {}, "احتساب الرواتب: إدخال يدوي"),
        el(
          "p",
          {},
          "قواعد الاستحقاق والتوزيع النسبي وتعديل تواريخ العقود لم تُعتمد. لا توجد أتمتة مالية.",
        ),
      ),
    ),
    submit,
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      await saveSettings(state, {
        soon_days: Number(days.value),
        salary_mode: "manual",
        salary_policy_notes: notes.value.trim(),
      });
      await refresh();
      notify("تم حفظ الإعدادات");
    } catch (error) {
      showError(error, errors);
    } finally {
      submit.disabled = false;
    }
  });
  const statuses = el(
    "section",
    { class: "panel settings-panel" },
    el(
      "div",
      { class: "panel-heading" },
      el("h2", {}, "حالات العقود"),
      button("إضافة حالة", () => statusForm(state, refresh), "primary"),
    ),
    el(
      "div",
      { class: "status-list" },
      (state.data.contract_statuses || []).map((row) =>
        el(
          "div",
          { class: "status-item" },
          el(
            "span",
            {},
            el("strong", {}, row.label),
            el(
              "small",
              { class: "small-note d-block" },
              row.code +
                " · " +
                (row.is_active ? "متاحة للاختيار" : "موقوفة للاختيار الجديد"),
            ),
          ),
          button(
            "تعديل",
            () => statusForm(state, refresh, row),
            "small-button",
          ),
        ),
      ),
    ),
    hint("تبقى الحالات التاريخية محفوظة؛ لا تُحذف الحالة المستخدمة."),
  );
  return el("div", {}, form, statuses);
}
