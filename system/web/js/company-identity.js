import { client } from "./supabase-client.js";
import { el, button, notify, showError } from "./components/dom.js";

const bucket = "company-branding";
const defaults = { name_ar: "إدارة الشركة", primary_color: "#0f2744", secondary_color: "#006a61" };
const formats = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function loadLoginIdentity() {
  const { data, error } = await client.from("login_branding")
    .select("name_ar,name_en,primary_color,secondary_color,logo_png,favicon_png").limit(2);
  if (error) throw error;
  if (data.length !== 1) return null;
  const row = data[0];
  const png = (value) => value && /^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value)
    ? "data:image/png;base64," + value : null;
  return { ...row, logo_url: png(row.logo_png), favicon_url: png(row.favicon_png) };
}

async function publicPng(path, size) {
  if (!path) return null;
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error) throw error;
  const bitmap = await createImageBitmap(data);
  try {
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  } finally {
    bitmap.close();
  }
}

function loginPublication(state) {
  const identity = state.identity;
  const errors = el("div");
  const result = el("p", { role: "status" });
  const publish = button("نشر الهوية المحفوظة", () => update(true), "primary");
  const unpublish = button("إلغاء نشر الهوية", () => update(false));
  async function update(published) {
    errors.replaceChildren();
    result.textContent = "";
    publish.disabled = unpublish.disabled = true;
    try {
      const organization_id = state.context.organization_id;
      const table = client.from("login_branding");
      const request = published
        ? table.upsert({
          organization_id, published,
          name_ar: identity.name_ar, name_en: identity.name_en,
          primary_color: identity.primary_color, secondary_color: identity.secondary_color,
          logo_png: await publicPng(identity.logo_path, 256),
          favicon_png: await publicPng(identity.favicon_path, 64),
        }, { onConflict: "organization_id" })
        : table.update({ published: false }).eq("organization_id", organization_id);
      const { error } = await request;
      if (error) throw error;
      result.textContent = published ? "تم نشر الهوية لشاشة الدخول." : "أُلغي عرض الهوية قبل الدخول.";
    } catch (error) {
      showError(error, errors);
    } finally {
      publish.disabled = !identity;
      unpublish.disabled = false;
    }
  }
  publish.disabled = !identity;
  return el("section", { class: "panel settings-panel" },
    el("h2", {}, "الهوية قبل تسجيل الدخول"),
    el("p", { class: "hint" }, "ينشر هذا الخيار الاسم والألوان ونسختين مصغرتين من الشعار والأيقونة المحفوظين. هذه البيانات يمكن قراءتها دون تسجيل الدخول. احفظ تعديلاتك أولًا ثم انشرها."),
    errors, result, el("div", { class: "modal-footer" }, publish, unpublish));
}

export async function loadIdentity(organizationId, manager) {
  const { data, error } = await (manager
    ? client.from("company_identity").select("*").eq("organization_id", organizationId).maybeSingle()
    : client.rpc("member_company_identity", { org: organizationId }));
  if (error) throw error;
  if (!data) return null;
  await Promise.all(["logo", "favicon"].map(async (kind) => {
    const path = data[kind + "_path"];
    if (!path) return;
    const signed = await client.storage.from(bucket).createSignedUrl(path, 3600);
    if (!signed.error) data[kind + "_url"] = signed.data.signedUrl;
  }));
  return data;
}

export function identityName(identity) {
  return identity?.name_ar || defaults.name_ar;
}

export function identityMark(identity) {
  const src = identity?.logo_url;
  return el("span", { class: "brand-mark" }, src
    ? el("img", { src, alt: "", class: "company-logo" })
    : "▥");
}

export function applyIdentity(identity) {
  const theme = { ...defaults, ...identity };
  for (const [property, value] of [["--company-primary", theme.primary_color], ["--company-secondary", theme.secondary_color]]) {
    if (/^#[0-9a-f]{6}$/i.test(value)) document.documentElement.style.setProperty(property, value);
  }
  document.title = identityName(identity) + " | إدارة التأجير";
  document.querySelector("#company-favicon")?.remove();
  if (identity?.favicon_url) document.head.append(el("link", {
    id: "company-favicon", rel: "icon", href: identity.favicon_url,
  }));
}

async function uploadAsset(file, organizationId, kind) {
  if (!formats[file.type] || !file.size || file.size > 2097152)
    throw new Error("اختر صورة PNG أو JPEG أو WebP بحجم لا يتجاوز ٢ ميغابايت.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("تعذّر قراءة الصورة.");
  bitmap.close();
  const path = `${organizationId}/${kind}/${crypto.randomUUID()}.${formats[file.type]}`;
  const { error } = await client.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export function identityView(state, refresh, navigate) {
  const current = state.identity;
  const inputs = {};
  const fields = [
    ["name_ar", "اسم الشركة بالعربية", "text", 120],
    ["name_en", "اسم الشركة بالإنجليزية", "text", 120],
    ["primary_color", "اللون الأساسي", "color"],
    ["secondary_color", "اللون الثانوي", "color"],
    ["phone", "الهاتف", "tel", 30],
    ["whatsapp", "واتساب", "tel", 30],
    ["email", "البريد الإلكتروني", "email", 254],
    ["address", "العنوان", "text", 300],
  ].map(([key, label, type, maxlength]) => {
    const input = inputs[key] = el("input", {
      type, maxlength, required: key === "name_ar",
      value: current?.[key] ?? (key === "name_ar" ? state.context.organization_name : defaults[key] || ""),
    });
    return el("label", {}, label, input);
  });
  const images = {};
  for (const [kind, label] of [["logo", "الشعار"], ["favicon", "أيقونة المتصفح"]]) {
    const file = el("input", { type: "file", accept: Object.keys(formats).join(",") });
    const remove = el("input", { type: "checkbox" });
    images[kind] = { file, remove };
    fields.push(el("div", {}, el("label", {}, label, file),
      current?.[kind + "_path"] ? el("label", { class: "checkbox" }, remove, "إزالة الصورة الحالية") : null));
  }
  const errors = el("div");
  const save = el("button", { type: "submit", class: "primary" }, "حفظ الهوية");
  const form = el("form", {
    class: "panel settings-panel company-identity",
    onSubmit: async (event) => {
      event.preventDefault();
      errors.replaceChildren();
      save.disabled = true;
      try {
        const organizationId = state.context.organization_id;
        const values = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value.trim()]));
        for (const [kind, { file, remove }] of Object.entries(images)) {
          values[kind + "_path"] = file.files[0]
            ? await uploadAsset(file.files[0], organizationId, kind)
            : remove.checked ? null : current?.[kind + "_path"] ?? null;
        }
        const table = client.from("company_identity");
        const write = current
          ? table.update(values).eq("organization_id", organizationId).eq("updated_at", current.updated_at)
          : table.insert({ ...values, organization_id: organizationId });
        const { data, error } = await write.select("organization_id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("تغيّرت الإعدادات منذ فتح الصفحة. حدّث الصفحة ثم حاول مجددًا.");
        await refresh();
        notify("تم حفظ هوية الشركة");
      } catch (error) {
        showError(error, errors);
      } finally {
        save.disabled = false;
      }
    },
  }, el("h2", {}, current ? "بيانات الهوية" : "إعداد هوية الشركة لأول مرة"),
  el("p", { class: "hint" }, "تظهر الهوية للأعضاء بعد الدخول. بيانات التواصل متاحة للمدير فقط."),
  errors, el("div", { class: "form-grid" }, fields),
  el("div", { class: "modal-footer" }, save, button("العودة إلى لوحة المعلومات", () => navigate("dashboard"))));
  return el("div", {}, form, loginPublication(state));
}
