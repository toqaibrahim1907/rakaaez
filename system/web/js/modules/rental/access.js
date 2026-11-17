import { el, button, hint, showError, notify } from "../../components/dom.js";
import { rpc } from "../../data/repository.js";
import { permissionName } from "../../permissions.js";
export function accessView(state, refresh) {
  const roles = state.data.roles || [];
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const errors = el("div");
  const user = el("input", {
    name: "user_id",
    required: true,
    dir: "ltr",
    placeholder: "UUID من Supabase Auth",
  });
  const role = el(
    "select",
    { required: true },
    el("option", { value: "" }, "اختر الدور"),
    roles.map((r) => el("option", { value: r.id }, r.name)),
  );
  const active = el("input", { type: "checkbox", checked: true });
  const assign = el(
    "button",
    { class: "primary", type: "submit" },
    "حفظ المستخدم",
  );
  const memberForm = el(
    "form",
    { class: "panel" },
    el("h2", {}, "تعيين دور لمستخدم"),
    hint(
      "أنشئ الحساب في Supabase Authentication أولاً، ثم أدخل معرّف المستخدم. هذا الإجراء لا يرسل دعوة ولا يغيّر خصوصية الموقع.",
    ),
    errors,
    el("label", {}, "معرّف مستخدم Auth", user),
    el("label", {}, "الدور", role),
    el("label", { class: "checkbox" }, active, "وصول فعّال"),
    assign,
  );
  memberForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    assign.disabled = true;
    try {
      await rpc("rental_assign_member", {
        p_organization_id: state.context.organization_id,
        p_user_id: user.value.trim(),
        p_role_id: role.value,
        p_active: active.checked,
      });
      await refresh();
      notify("تم حفظ صلاحيات المستخدم");
    } catch (error) {
      showError(error, errors);
    } finally {
      assign.disabled = false;
    }
  });
  const members = el(
    "div",
    { class: "member-list" },
    (state.data.members || []).map((member) =>
      el(
        "div",
        {},
        el(
          "span",
          {},
          el("strong", { dir: "ltr" }, member.email),
          el("small", { class: "d-block", dir: "ltr" }, member.user_id),
        ),
        el("span", {}, rolesById.get(member.role_id)?.name || "بدون دور"),
        button(
          member.is_active ? "تعديل" : "موقوف",
          () => {
            user.value = member.user_id;
            role.value = member.role_id || "";
            active.checked = member.is_active;
            user.focus();
          },
          "small-button",
        ),
      ),
    ),
  );
  memberForm.append(members);
  const roleSelect = el(
    "select",
    {},
    roles
      .filter((r) => r.code !== "manager")
      .map((r) => el("option", { value: r.id }, r.name)),
    el("option", { value: "new" }, "+ دور جديد"),
  );
  const roleCode = el("input", {
    required: true,
    pattern: "[a-z][a-z0-9_-]{1,40}",
    dir: "ltr",
  });
  const roleName = el("input", { required: true, maxlength: 80 });
  const checkboxes = el("div", { class: "permission-grid" });
  const roleErrors = el("div");
  const save = el("button", { type: "submit", class: "primary" }, "حفظ الدور");
  const roleForm = el(
    "form",
    { class: "panel" },
    el("h2", {}, "صلاحيات الأدوار"),
    roleErrors,
    el("label", {}, "اختر الدور", roleSelect),
    el("label", {}, "المعرّف الثابت", roleCode),
    el("label", {}, "اسم الدور", roleName),
    checkboxes,
    hint(
      "المدير لديه كل الصلاحيات. تعديل التقييمات وإدارة الوصول للمدير فقط. الموظف يبدأ دون صلاحيات.",
    ),
    save,
  );
  function draw() {
    const current = rolesById.get(roleSelect.value);
    roleCode.value = current?.code || "";
    roleCode.disabled = Boolean(current);
    roleName.value = current?.name || "";
    const selected = new Set(
      (state.data.role_permissions || [])
        .filter((r) => r.role_id === current?.id)
        .map((r) => r.permission_code),
    );
    checkboxes.replaceChildren(
      (state.data.permissions || [])
        .filter(
          (p) =>
            !["rental.access.write", "rental.evaluations.write"].includes(
              p.code,
            ),
        )
        .map((p) =>
          el(
            "label",
            { class: "checkbox" },
            el("input", {
              type: "checkbox",
              name: "permission",
              value: p.code,
              checked: selected.has(p.code),
            }),
            el("span", {}, permissionName(p.code)),
          ),
        ),
    );
  }
  roleSelect.addEventListener("change", draw);
  roleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    try {
      const selected = new FormData(roleForm).getAll("permission");
      await rpc("rental_save_role", {
        p_organization_id: state.context.organization_id,
        p_code: roleCode.value.trim(),
        p_name: roleName.value.trim(),
        p_permissions: selected,
      });
      await refresh();
      notify("تم حفظ الدور");
    } catch (error) {
      showError(error, roleErrors);
    } finally {
      save.disabled = false;
    }
  });
  draw();
  return el("div", { class: "access-grid" }, memberForm, roleForm);
}
