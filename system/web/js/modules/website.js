import { el, notify, showError } from "../components/dom.js";
import { client } from "../supabase-client.js";
import { has } from "../permissions.js";

export function websiteView(state) {
  const panel = el("section", { class: "panel" }, el("h2", {}, "محتوى الموقع"));
  const status = el("p", {}, "جارٍ تحميل المحتوى…");
  panel.append(status);
  void (async () => {
    try {
      const org = state.context.organization_id;
      const { data, error } = await client.from("website_content").select("*").eq("organization_id", org).maybeSingle();
      if (error) throw error;
      const headline = el("input", { value: data?.draft?.headline ?? data?.headline ?? "", maxlength: 300 });
      const subhead = el("textarea", { rows: 4, maxlength: 2000 }, data?.draft?.subhead ?? data?.subhead ?? "");
      const form = el("form", {}, el("label", {}, "العنوان الرئيسي", headline), el("label", {}, "النص التعريفي", subhead));
      if (has(state.context, "website", "write")) {
        const save = el("button", { type: "submit", class: "primary" }, "حفظ المسودة");
        form.append(save);
        const publish = el("button", { type: "button", class: "secondary" }, "نشر المسودة");
        publish.addEventListener("click", async () => {
          publish.disabled = true;
          try {
            const current = await client.from("website_content").select("draft").eq("organization_id", org).single();
            if (current.error) throw current.error;
            const draft = current.data.draft || {};
            const result = await client.from("website_content").update({ headline: draft.headline || "", subhead: draft.subhead || "", published: true, updated_at: new Date().toISOString() }).eq("organization_id", org).select("organization_id");
            if (result.error) throw result.error;
            if (!result.data.length) throw new Error("تعذر نشر المحتوى");
            notify("تم نشر المسودة المحفوظة");
          } catch (error) { showError(error); } finally { publish.disabled = false; }
        });
        form.append(publish);
        form.addEventListener("submit", async event => {
          event.preventDefault(); save.disabled = true;
          try {
            const draft = { ...(data?.draft || {}), headline: headline.value, subhead: subhead.value };
            const payload = { organization_id: org, draft, updated_at: new Date().toISOString() };
            const result = await client.from("website_content").upsert(payload, { onConflict: "organization_id" });
            if (result.error) throw result.error;
            if (data) data.draft = draft;
            notify("تم حفظ المسودة");
          } catch (error) { showError(error); } finally { save.disabled = false; }
        });
      } else { headline.disabled = true; subhead.disabled = true; }
      status.replaceWith(form, el("p", {}, "احفظ المسودة أولاً، ثم انشرها لعرضها على الموقع الجديد."));
    } catch (error) { status.textContent = "تعذر تحميل المحتوى"; showError(error); }
  })();
  return panel;
}

