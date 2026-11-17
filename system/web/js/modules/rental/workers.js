import { crudView } from "./crud.js";
import { has } from "../../permissions.js";
import { button, el } from "../../components/dom.js";
import { recordForm } from "../../components/forms.js";
import { modal, closeModal } from "../../components/modal.js";
import { saveRecord } from "../../data/repository.js";
export function workerExtras(state, row, refresh) {
  const actions = [];
  if (has(state.context, "workers_private"))
    actions.push(
      button(
        "البيانات الخاصة",
        () => {
          const privateRow = state.data.workers_private?.find(
            (r) => r.id === row.id,
          );
          if (has(state.context, "workers_private", "write"))
            recordForm(state, "workers_private", privateRow, refresh, {
              id: row.id,
            });
          else
            import("./crud.js").then(({ profile }) =>
              profile(
                state,
                "workers_private",
                privateRow || { id: row.id },
                refresh,
              ),
            );
        },
        "small-button",
      ),
    );
  if (has(state.context, "workers", "write"))
    actions.push(
      button(
        row.archived_at ? "استعادة" : "أرشفة",
        () => {
          const reason = el("textarea", {
            name: "reason",
            required: !row.archived_at,
            rows: 3,
          });
          const errors = el("div");
          const submit = el(
            "button",
            { class: "primary", type: "submit" },
            "حفظ",
          );
          const form = el(
            "form",
            {},
            errors,
            el(
              "p",
              {},
              row.archived_at
                ? "ستعود العاملة إلى قائمة العاملات. لن تتغير عقودها أو رواتبها."
                : "أرشفة ملف العاملة مع الاحتفاظ بالعقود والرواتب.",
            ),
            row.archived_at ? null : el("label", {}, "سبب الأرشفة", reason),
            el("footer", { class: "modal-footer" }, button("إلغاء", closeModal), submit),
          );
          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            submit.disabled = true;
            try {
              await saveRecord(
                state,
                "workers",
                {
                  archived_at: row.archived_at
                    ? null
                    : new Date().toISOString(),
                  archive_reason: row.archived_at ? null : reason.value.trim(),
                },
                row,
              );
              closeModal();
              await refresh();
            } catch (error) {
              errors.textContent = error.message;
            } finally {
              submit.disabled = false;
            }
          });
          modal(row.archived_at ? "استعادة العاملة" : "أرشفة العاملة", form, { section: "العاملات", size: "compact" });
        },
        "small-button",
      ),
    );
  return actions;
}
export const workersView = (state, refresh) =>
  crudView(state, "workers", refresh, {
    extraActions: (row) => workerExtras(state, row, refresh),
  });
