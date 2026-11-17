import { el, button, hint, badge } from "../../components/dom.js";
import { modal, confirmAction } from "../../components/modal.js";
import { recordForm } from "../../components/forms.js";
import { table, valueFor } from "../../components/table.js";
import { models, dateKeys, paymentState } from "../../data/model.js";
import { deleteRecord } from "../../data/repository.js";
import { has } from "../../permissions.js";
export function canWrite(state, kind) {
  return kind === "evaluations"
    ? state.context.manager
    : has(state.context, models[kind].permission, "write");
}
export function profile(state, kind, row, refresh, extraActions = []) {
  const model = models[kind];
  const content = el(
    "div",
    {},
    el(
      "div",
      { class: "profile-grid" },
      model.fields.map((field) =>
        el(
          "div",
          {},
          el("small", {}, field.label),
          el("strong", {}, valueFor(state, field, row)),
        ),
      ),
    ),
  );
  const actions = el(
    "div",
    { class: "profile-actions" },
    canWrite(state, kind)
      ? button(
          "تعديل البيانات",
          () => recordForm(state, kind, row, refresh),
          "primary",
        )
      : null,
    extraActions,
  );
  content.append(actions);
  if (kind === "workers") {
    for (const related of ["contracts", "evaluations", "salaries", "recruitment", "housing"])
      if (has(state.context, models[related].permission)) {
        content.append(
          el("h3", { class: "mt-4 mb-3" }, models[related].title),
          table(
            state,
            related,
            (state.data[related] || []).filter(
              (item) => item.worker_id === row.id,
            ),
            { profile: (item) => profile(state, related, item, refresh) },
          ),
        );
      }
  }
  modal("تفاصيل · " + model.title, content);
}
export function rowActions(state, kind, row, refresh, extras = () => []) {
  return [
    button(
      "عرض",
      () => profile(state, kind, row, refresh, extras(row)),
      "small-button",
    ),
    ...(canWrite(state, kind)
      ? [
          button(
            "تعديل",
            () => recordForm(state, kind, row, refresh),
            "small-button",
          ),
          ...(models[kind].table.startsWith("operations_") ? [] : [button(
            "حذف",
            () =>
              confirmAction(
                "حذف السجل",
                "سيتم حذف هذا السجل. السجلات المرتبطة تمنع الحذف للحفاظ على التاريخ.",
                async () => {
                  await deleteRecord(state, kind, row);
                  await refresh();
                },
              ),
            "small-button danger",
          )]),
        ]
      : []),
    ...extras(row),
  ];
}
export function crudView(
  state,
  kind,
  refresh,
  { archived = false, extraActions = () => [], message } = {},
) {
  const model = models[kind];
  let rows = (state.data[kind] || []).filter(
    (r) => kind !== "workers" || Boolean(r.archived_at) === archived,
  );
  const output = el("div");
  const controls = el("div", { class: "filters" });
  const search = el("input", {
    placeholder: "ابحث بالاسم، الهوية، رقم العقد أو العاملة...",
    type: "search",
    "aria-label": "بحث",
  });
  controls.append(el("label", { class: "search" }, "⌕", search));
  const statusKey =
    kind === "workers"
      ? "availability_status_id"
      : kind === "contracts"
        ? "status_id"
        : kind === "salaries"
          ? "administrative_state"
          : model.fields.find((field) => ["stage", "status", "reason"].includes(field.key))?.key;
  let statusInput = null;
  if (statusKey) {
    const field = model.fields.find((f) => f.key === statusKey);
    statusInput = el(
      "select",
      { "aria-label": "الحالة" },
      el("option", { value: "" }, "كل الحالات"),
    );
    const choices =
      field.options ||
      (state.data[field.ref] || []).map((r) => [r.id, r.label]);
    for (const [id, label] of choices)
      statusInput.append(el("option", { value: id }, label));
    controls.append(statusInput);
  }
  const paymentFilter =
    kind === "salaries"
      ? el(
          "select",
          { "aria-label": "حالة الدفع" },
          el("option", { value: "" }, "كل الدفعات"),
          ["غير مدفوع", "جزئي", "مدفوع", "دفعات زائدة"].map((label) =>
            el("option", { value: label }, label),
          ),
        )
      : null;
  if (paymentFilter) controls.append(paymentFilter);
  const nationality =
    kind === "workers"
      ? el(
          "select",
          { "aria-label": "الجنسية" },
          el("option", { value: "" }, "كل الجنسيات"),
          [...new Set(rows.map((r) => r.nationality))]
            .sort()
            .map((n) => el("option", { value: n }, n)),
        )
      : null;
  if (nationality) controls.append(nationality);
  const from = el("input", { type: "date", "aria-label": "من تاريخ" }),
    to = el("input", { type: "date", "aria-label": "إلى تاريخ" });
  if (!["workers", "clients"].includes(kind)) {
    controls.append(
      el("label", { class: "date-filter" }, "من", from),
      el("label", { class: "date-filter" }, "إلى", to),
    );
  }
  const count = el("span", { class: "row-count" }),
    result = el("div");
  function draw() {
    const query = search.value.trim().toLowerCase();
    const visible = rows.filter((row) => {
      const date = String(row[dateKeys[kind]] || "").slice(0, 10);
      const privateRow = state.data[kind + "_private"]?.find(
        (r) => r.id === row.id,
      );
      const values = [
        ...model.fields.map((f) => valueFor(state, f, row)),
        ...Object.values(privateRow || {}),
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!query || values.includes(query)) &&
        (!statusInput?.value || row[statusKey] === statusInput.value) &&
        (!paymentFilter?.value ||
          paymentState(state, row) === paymentFilter.value) &&
        (!nationality?.value || row.nationality === nationality.value) &&
        (!from.value || date >= from.value) &&
        (!to.value || date <= to.value)
      );
    });
    count.textContent = `${visible.length} سجل`;
    result.replaceChildren(
      table(state, kind, visible, {
        actions: (row) => rowActions(state, kind, row, refresh, extraActions),
        profile: (row) => profile(state, kind, row, refresh, extraActions(row)),
      }),
    );
  }
  for (const input of [
    search,
    statusInput,
    paymentFilter,
    nationality,
    from,
    to,
  ].filter(Boolean))
    input.addEventListener(input === search ? "input" : "change", draw);
  if (message) output.append(el("div", { class: "info-banner" }, message));
  output.append(
    el(
      "section",
      { class: "panel" },
      controls,
      el(
        "div",
        { class: "table-caption" },
        el("b", {}, archived ? "العاملات المؤرشفات" : `سجل ${model.title}`),
        count,
      ),
      result,
    ),
  );
  draw();
  return output;
}
