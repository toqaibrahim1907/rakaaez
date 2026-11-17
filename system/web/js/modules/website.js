import { el, notify, showError } from "../components/dom.js";
import { client } from "../supabase-client.js";
import { has } from "../permissions.js";
import { modal, closeModal } from "../components/modal.js";

export function websiteContentView(state) {
  const panel = el("section", { class: "panel" }, el("h2", {}, "محتوى الموقع"));
  const status = el("p", {}, "جارٍ تحميل المحتوى…");
  panel.append(status);
  void (async () => {
    try {
      const org = state.context.organization_id;
      const result = await client.from("website_content").select("*").eq("organization_id", org).maybeSingle();
      let data = result.data; const error = result.error;
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
            const current = await client.from("website_content").select("draft,images").eq("organization_id", org).single();
            if (current.error) throw current.error;
            const draft = current.data.draft || {};
            const images = { ...(current.data.images || {}), ...(draft.images || {}) };
            const result = await client.from("website_content").update({ headline: draft.headline || "", subhead: draft.subhead || "", images, published: true, updated_at: new Date().toISOString() }).eq("organization_id", org).select("organization_id");
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
            if (data) data.draft = draft; else data = { draft };
            notify("تم حفظ المسودة");
          } catch (error) { showError(error); } finally { save.disabled = false; }
        });
        const imageInput = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp" });
        const uploadImage = el("button", { type: "button", class: "secondary" }, "حفظ صورة الغلاف في المسودة");
        uploadImage.addEventListener("click", async () => {
          const file = imageInput.files?.[0];
          if (!file || !file.size || file.size > 5242880) { showError(new Error("اختاري صورة لا تتجاوز 5 ميجابايت.")); return; }
          const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
          const valid = (file.type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) || (file.type === "image/png" && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) || (file.type === "image/webp" && new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP");
          if (!valid) { showError(new Error("نوع الصورة غير مدعوم أو لا يطابق محتواها.")); return; }
          uploadImage.disabled = true; const path = `${org}/${crypto.randomUUID()}`; let uploaded = false;
          try {
            const upload = await client.storage.from("website-site-media").upload(path, file, { contentType: file.type, upsert: false });
            if (upload.error) throw upload.error; uploaded = true;
            const current = await client.from("website_content").select("draft").eq("organization_id", org).maybeSingle();
            if (current.error) throw current.error;
            const draft = { ...(current.data?.draft || {}), images: { ...(current.data?.draft?.images || {}), hero: path } };
            const saved = await client.from("website_content").upsert({ organization_id: org, draft, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
            if (saved.error) throw saved.error;
            data = { ...(data || {}), draft }; imageInput.value = ""; notify("حُفظت صورة الغلاف في المسودة؛ انشريها لعرضها.");
          } catch (error) { if (uploaded) await client.storage.from("website-site-media").remove([path]); showError(error); }
          finally { uploadImage.disabled = false; }
        });
        form.append(el("label", {}, "صورة الغلاف · حتى 5 ميجابايت", imageInput), uploadImage);
      } else { headline.disabled = true; subhead.disabled = true; }
      status.replaceWith(form, el("p", {}, "احفظ المسودة أولاً، ثم انشرها لعرضها على الموقع الجديد."));
    } catch (error) { status.textContent = "تعذر تحميل المحتوى"; showError(error); }
  })();
  return panel;
}

async function analyzeCv(row) {
  async function request(url, options = {}) {
    const session = await client.auth.getSession();
    const token = session.data?.session?.access_token;
    if (session.error || !token) throw new Error("يرجى تسجيل الدخول مجدداً.");
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error === "cv_extraction_not_configured" ? "خدمة تحليل السير غير مُعدّة على الخادم." : "تعذر الاتصال بخدمة تحليل السير.");
    return payload;
  }
  const start = await request("/api/worker-extraction", { method: "POST", body: JSON.stringify({ cv_path: row.cv_path, file_name: row.cv_file_name }) });
  if (!/^[0-9a-f-]{36}$/i.test(start.job_id || "")) throw new Error("تعذر بدء التحليل.");
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const job = await request(`/api/worker-extraction?job_id=${encodeURIComponent(start.job_id)}`);
    if (job.status === "complete" && job.result) return job.result;
    if (job.status === "failed") throw new Error("تعذر تحليل السيرة؛ يمكنك إدخال البيانات يدوياً.");
  }
  throw new Error("انتهت مهلة التحليل؛ يمكنك المحاولة مجدداً.");
}

function reviewCv(state, row, result, refresh) {
  const fields = result.fields || {};
  const definitions = [["name", "الاسم الداخلي", row.name], ["nationality", "الجنسية", row.nationality], ["job", "المهنة", row.profession], ["age", "العمر", row.age], ["salary", "الراتب", row.salary], ["religion", "الديانة", row.religion], ["passport_number", "رقم الجواز", row.passport_number], ["experience", "الخبرة", row.experience]];
  const controls = Object.fromEntries(definitions.map(([key, label, fallback]) => [key, { label, input: el("input", { value: fields[key] ?? fallback ?? "", maxlength: 200 }) }]));
  const service = el("select", {}, ["الاستقدام", "التأجير"].map(value => el("option", { value }, value))); service.value = row.service || "الاستقدام";
  const languages = el("input", { value: row.languages || "", maxlength: 200 });
  const skills = el("input", { value: row.skills || "", maxlength: 500 });
  const cost = el("input", { type: "number", min: 0, step: "0.01", value: row.total_recruitment_cost ?? "" });
  const form = el("form", {}, el("p", {}, "راجعي البيانات المستخرجة وعدّليها قبل الحفظ. لا تُنشر البيانات الخاصة على الموقع."),
    el("label", {}, "نوع الخدمة", service),
    definitions.map(([key]) => {
      const confidence = Number(result.confidence?.[key]);
      const hint = Number.isFinite(confidence) && result.confidence?.[key] != null ? (confidence < 0.72 ? " · يحتاج مراجعة" : " · ثقة مرتفعة") : " · راجعي القيمة";
      return el("label", {}, controls[key].label, el("small", {}, hint), controls[key].input);
    }),
    el("label", {}, "اللغات", languages), el("label", {}, "المهارات", skills), el("label", {}, "إجمالي سعر الاستقدام", cost),
    (result.warnings || []).filter(value => typeof value === "string").map(value => el("p", {}, value)));
  const photos = Array.isArray(result.photos) ? result.photos.filter(photo => typeof photo?.data === "string" && photo.data.length <= 400000 && /^[A-Za-z0-9+/=]+$/.test(photo.data)) : [];
  let choice;
  if (photos.length) {
    choice = el("select", {}, el("option", { value: "" }, "الاحتفاظ بالصورة الحالية"), photos.map((photo, index) => el("option", { value: String(index) }, `صورة ${index + 1}`)));
    const preview = el("img", { alt: "معاينة الصورة المختارة", style: "max-width:180px;display:block", hidden: true });
    choice.addEventListener("change", () => { const photo = photos[Number(choice.value)]; preview.hidden = !choice.value || !photo; if (!preview.hidden) preview.src = `data:image/jpeg;base64,${photo.data}`; });
    form.append(el("label", {}, "صورة العاملة المستخرجة", choice), preview);
  }
  const save = el("button", { type: "submit", class: "primary" }, "حفظ البيانات بعد المراجعة");
  form.append(save, el("button", { type: "button", class: "secondary", onClick: closeModal }, "إلغاء"));
  form.addEventListener("submit", async event => {
    event.preventDefault(); save.disabled = true; let uploadedPath = "";
    try {
      const values = Object.fromEntries(definitions.map(([key]) => [key, controls[key].input.value.trim()]));
      const update = { name: values.name, nationality: values.nationality, profession: values.job, age: values.age, salary: values.salary, religion: values.religion, passport_number: values.passport_number, experience: values.experience, service: service.value, languages: languages.value.trim(), skills: skills.value.trim(), total_recruitment_cost: cost.value === "" ? null : Number(cost.value), extracted: true, updated_at: new Date().toISOString() };
      if (choice?.value) {
        const binary = atob(photos[Number(choice.value)].data), bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
        uploadedPath = `${state.context.organization_id}/${row.id}/${crypto.randomUUID()}`;
        const upload = await client.storage.from("website-worker-photos").upload(uploadedPath, new Blob([bytes], { type: "image/jpeg" }), { contentType: "image/jpeg", upsert: false });
        if (upload.error) { uploadedPath = ""; throw upload.error; }
        update.photo_path = uploadedPath;
      }
      const saved = await client.from("website_workers").update(update).eq("organization_id", state.context.organization_id).eq("id", row.id).select("id");
      if (saved.error) throw saved.error;
      if (!saved.data.length) throw new Error("تعذر حفظ البيانات.");
      closeModal(); await refresh(); notify("تم حفظ البيانات بعد المراجعة.");
    } catch (error) { if (uploadedPath) await client.storage.from("website-worker-photos").remove([uploadedPath]); showError(error); }
    finally { save.disabled = false; }
  });
  modal("مراجعة بيانات السيرة", form, { section: "إدارة الموقع" });
}

export function websiteOverview(state) {
  const panel = el("section", { class: "panel" }, el("h2", {}, "نظرة عامة على الموقع"));
  const status = el("p", {}, "جارٍ تحميل الملخص…"); panel.append(status);
  void (async () => {
    try {
      const org = state.context.organization_id;
      const results = await Promise.all(["website_requests", "website_complaints", "website_workers"].map(table => client.from(table).select("id", { count: "exact", head: true }).eq("organization_id", org)));
      const error = results.find(result => result.error)?.error; if (error) throw error;
      status.replaceWith(el("div", { class: "stats-grid" }, ["طلبات الموقع", "شكاوى الموقع", "بطاقات العاملات"].map((label, index) => el("div", { class: "stat blue" }, el("strong", {}, results[index].count ?? 0), el("h3", {}, label)))));
    } catch (error) { status.textContent = "تعذر تحميل الملخص."; showError(error); }
  })();
  return panel;
}

export function websiteWorkers(state, filesOnly = false) {
  const org = state.context.organization_id;
  const container = el("section", { class: "panel" }, el("h2", {}, filesOnly ? "السير الذاتية وصور العاملات" : "بطاقات عاملات الموقع"));
  const list = el("div", {}, "جارٍ التحميل…");
  async function load() {
    const { data, error } = await client.from("website_workers").select("id,ref,name,nationality,profession,age,experience,salary,religion,passport_number,service,languages,skills,total_recruitment_cost,publication,availability,cv_path,cv_file_name,photo_path").eq("organization_id", org).order("created_at", { ascending: false });
    if (error) { showError(error); list.textContent = "تعذر تحميل البطاقات"; return; }
    list.replaceChildren(...(data.length ? data.map(row => {
      const card = el("article", { class: "website-inbox-card" }, el("strong", {}, row.ref), el("p", {}, `${row.name} · ${row.nationality} · ${row.profession}`), el("p", {}, `${row.publication} · ${row.availability}`));
      for (const [label, bucket, path] of [["فتح السيرة", "website-worker-cvs", row.cv_path], ["فتح الصورة", "website-worker-photos", row.photo_path]]) {
        if (!path) continue;
        const open = el("button", { type: "button", class: "secondary" }, label);
        open.addEventListener("click", async () => {
          try {
            const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60);
            if (error) throw error;
            const link = el("a", { href: data.signedUrl, target: "_blank", rel: "noopener noreferrer" }, "فتح الرابط المؤقت");
            open.replaceWith(link);
          } catch (error) { showError(error); }
        });
        card.append(open);
      }
      if (has(state.context, "website", "write")) {
        if (row.cv_path) {
          const analyze = el("button", { type: "button", class: "secondary" }, "تحليل السيرة ومراجعة البيانات");
          const progress = el("span", { role: "status" });
          analyze.addEventListener("click", async () => {
            analyze.disabled = true; progress.textContent = "جارٍ تحليل السيرة…";
            try { const result = await analyzeCv(row); reviewCv(state, row, result, load); progress.textContent = ""; }
            catch (error) { progress.textContent = "تعذر التحليل. الملف محفوظ ويمكنك تعديل البيانات يدويًا."; showError(error); }
            finally { analyze.disabled = false; }
          });
          card.append(analyze, progress);
        }
        for (const kind of ["cv", "photo"]) {
          const isCv = kind === "cv", bucket = isCv ? "website-worker-cvs" : "website-worker-photos";
          const input = el("input", { type: "file", accept: isCv ? "application/pdf" : "image/jpeg,image/png,image/webp" });
          const upload = el("button", { type: "button", class: "secondary" }, isCv ? "رفع السيرة" : "رفع الصورة");
          upload.addEventListener("click", async () => {
            const file = input.files?.[0];
            if (!file || !file.size || file.size > (isCv ? 15728640 : 5242880)) { showError(new Error("اختاري ملفاً صالحاً بالحجم المسموح.")); return; }
            const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
            const valid = isCv ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-" :
              (file.type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
              (file.type === "image/png" && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) ||
              (file.type === "image/webp" && new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP");
            if (!valid) { showError(new Error("نوع الملف غير مدعوم أو لا يطابق محتواه.")); return; }
            upload.disabled = true; const path = `${org}/${row.id}/${crypto.randomUUID()}`; let uploaded = false;
            try {
              const result = await client.storage.from(bucket).upload(path, file, { contentType: isCv ? "application/pdf" : file.type, upsert: false });
              if (result.error) throw result.error; uploaded = true;
              const update = await client.from("website_workers").update(isCv ? { cv_path: path, cv_file_name: file.name.slice(0, 200) } : { photo_path: path }).eq("organization_id", org).eq("id", row.id).select("id");
              if (update.error) throw update.error;
              if (!update.data.length) throw new Error("تعذر ربط الملف بالبطاقة.");
              await load(); notify("تم رفع الملف");
            } catch (error) { if (uploaded) await client.storage.from(bucket).remove([path]); showError(error); }
            finally { upload.disabled = false; }
          });
          card.append(el("label", {}, isCv ? "السيرة PDF · حتى 15 ميجابايت" : "الصورة · حتى 5 ميجابايت", input), upload);
        }
        if (!filesOnly) {
        const edit = el("button", { type: "button", class: "secondary" }, "تعديل البطاقة");
        edit.addEventListener("click", () => {
          if (card.querySelector("form")) return;
          const name = el("input", { required: true, maxlength: 150, value: row.name });
          const nationality = el("input", { required: true, maxlength: 100, value: row.nationality });
          const profession = el("input", { required: true, maxlength: 100, value: row.profession });
          const age = el("input", { maxlength: 20, value: row.age || "" });
          const experience = el("input", { maxlength: 200, value: row.experience || "" });
          const availability = el("select", {}, ["متاحة", "تم الحجز", "غير متاحة", "مؤرشفة"].map(value => el("option", { value }, value)));
          availability.value = row.availability;
          const save = el("button", { type: "submit", class: "primary" }, "حفظ التعديلات");
          const cancel = el("button", { type: "button", class: "secondary" }, "إلغاء");
          const form = el("form", {}, el("label", {}, "الاسم الداخلي", name), el("label", {}, "الجنسية", nationality), el("label", {}, "المهنة", profession), el("label", {}, "العمر", age), el("label", {}, "الخبرة", experience), el("label", {}, "التوفر", availability), save, cancel);
          cancel.addEventListener("click", () => form.remove());
          form.addEventListener("submit", async event => {
            event.preventDefault(); save.disabled = true;
            try {
              const result = await client.from("website_workers").update({ name: name.value.trim(), nationality: nationality.value.trim(), profession: profession.value.trim(), age: age.value.trim(), experience: experience.value.trim(), availability: availability.value, updated_at: new Date().toISOString() }).eq("organization_id", org).eq("id", row.id).select("id");
              if (result.error) throw result.error;
              if (!result.data.length) throw new Error("تعذر حفظ البطاقة");
              await load(); notify("تم حفظ البطاقة");
            } catch (error) { showError(error); } finally { save.disabled = false; }
          });
          card.append(form); name.focus();
        });
        const toggle = el("button", { type: "button", class: "secondary" }, row.publication === "منشورة" ? "إلغاء النشر" : "نشر البطاقة");
        toggle.addEventListener("click", async () => {
          toggle.disabled = true;
          try {
            const result = await client.from("website_workers").update({ publication: row.publication === "منشورة" ? "مسودة" : "منشورة", updated_at: new Date().toISOString() }).eq("organization_id", org).eq("id", row.id).select("id");
            if (result.error) throw result.error;
            if (!result.data.length) throw new Error("تعذر تحديث البطاقة");
            await load(); notify("تم تحديث البطاقة");
          } catch (error) { showError(error); } finally { toggle.disabled = false; }
        });
        card.append(edit, toggle);
        }
      }
      return card;
    }) : [el("p", { class: "empty" }, "لا توجد بطاقات حالياً.")]));
  }
  if (filesOnly && has(state.context, "website", "write")) {
    const input = el("input", { type: "file", accept: "application/pdf,.pdf", required: true });
    const submit = el("button", { type: "submit", class: "primary" }, "رفع السيرة وتحليلها");
    const status = el("p", { role: "status" });
    const form = el("form", {}, el("label", {}, "اختاري سيرة ذاتية PDF · حتى 15 ميجابايت", input), submit, status);
    form.addEventListener("submit", async event => {
      event.preventDefault(); const file = input.files?.[0];
      if (!file || !file.name.toLowerCase().endsWith(".pdf") || !file.size || file.size > 15728640 || new TextDecoder().decode((await file.slice(0, 5).arrayBuffer())) !== "%PDF-") { status.textContent = "اختاري ملف PDF صالحًا لا يتجاوز 15 ميجابايت."; return; }
      submit.disabled = true; status.textContent = "جارٍ رفع السيرة…"; let id = "", path = "", linked = false;
      try {
        id = crypto.randomUUID(); const ref = `WK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const created = await client.from("website_workers").insert({ id, organization_id: org, ref, name: "قيد مراجعة السيرة", nationality: "", profession: "", cv_path: "", cv_file_name: "" }).select("id");
        if (created.error) throw created.error;
        if (!created.data.length) throw new Error("تعذر إنشاء المسودة.");
        path = `${org}/${id}/${crypto.randomUUID()}`;
        const upload = await client.storage.from("website-worker-cvs").upload(path, file, { contentType: "application/pdf", upsert: false });
        if (upload.error) { path = ""; throw upload.error; }
        const saved = await client.from("website_workers").update({ cv_path: path, cv_file_name: file.name.slice(0, 200) }).eq("organization_id", org).eq("id", id).select("id");
        if (saved.error) throw saved.error;
        if (!saved.data.length) throw new Error("تعذر ربط السيرة بالمسودة.");
        linked = true; await load(); status.textContent = "تم رفع السيرة. جارٍ تحليل البيانات…";
        const row = { id, cv_path: path, cv_file_name: file.name.slice(0, 200), name: "", nationality: "", profession: "", age: "", experience: "" };
        const result = await analyzeCv(row); status.textContent = "راجعي البيانات المستخرجة قبل حفظها."; input.value = ""; reviewCv(state, row, result, load);
      } catch (error) {
        if (!linked) { if (path) await client.storage.from("website-worker-cvs").remove([path]); if (id) await client.from("website_workers").delete().eq("organization_id", org).eq("id", id); }
        status.textContent = linked ? "السيرة محفوظة كمسودة. تعذر التحليل؛ يمكنك إعادة المحاولة أو إدخال البيانات يدويًا." : "تعذر رفع السيرة.";
        showError(error); await load();
      } finally { submit.disabled = false; }
    });
    container.append(form);
  }
  if (!filesOnly && has(state.context, "website", "write")) {
    const ref = el("input", { required: true, maxlength: 80 }), name = el("input", { required: true, maxlength: 150 }), nationality = el("input", { required: true, maxlength: 100 }), profession = el("input", { required: true, maxlength: 100 }), age = el("input", { maxlength: 20 }), experience = el("input", { maxlength: 200 });
    const submit = el("button", { type: "submit", class: "primary" }, "إضافة مسودة بطاقة");
    const form = el("form", {}, el("label", {}, "الرقم المرجعي", ref), el("label", {}, "الاسم الداخلي", name), el("label", {}, "الجنسية", nationality), el("label", {}, "المهنة", profession), el("label", {}, "العمر", age), el("label", {}, "الخبرة", experience), submit);
    form.addEventListener("submit", async event => {
      event.preventDefault(); submit.disabled = true;
      try {
        const result = await client.from("website_workers").insert({ organization_id: org, ref: ref.value.trim(), name: name.value.trim(), nationality: nationality.value.trim(), profession: profession.value.trim(), age: age.value.trim(), experience: experience.value.trim(), cv_path: "", cv_file_name: "" });
        if (result.error) throw result.error;
        form.reset(); await load(); notify("تمت إضافة المسودة");
      } catch (error) { showError(error); } finally { submit.disabled = false; }
    });
    container.append(form, el("p", {}, "الاسم والسيرة خاصان. تظهر الصورة للزوار عند نشر البطاقة وتوفر العاملة."));
  }
  container.append(list); void load(); return container;
}

export function websiteInbox(state, table, title) {
  const isComplaint = table === "website_complaints";
  const choices = isComplaint
    ? ["جديدة", "تم التواصل", "جاري الحل", "تم الحل", "تعذر التواصل"]
    : ["لم يتم التواصل", "تم التواصل", "تم التواصل ولم يرد", "رد العميل", "مكتمل", "معتذر عنه"];
  const container = el("section", { class: "panel" }, el("h2", {}, title));
  const list = el("div", {}, el("p", {}, "جارٍ التحميل…"));
  container.append(list);
  void (async () => {
    try {
      const org = state.context.organization_id;
      const fields = isComplaint ? "id,phone,complaint_text,status,internal_notes,created_at" : "id,customer_name,mobile,service,notes,status,internal_notes,created_at";
      const { data, error } = await client.from(table).select(fields).eq("organization_id", org).order("created_at", { ascending: false });
      if (error) throw error;
      if (!data.length) { list.replaceChildren(el("p", { class: "empty" }, "لا توجد سجلات حالياً.")); return; }
      list.replaceChildren(...data.map(row => {
        const status = el("select", { "aria-label": "الحالة", disabled: !has(state.context, "website", "write") },
          [...new Set([...choices, row.status])].map(value => el("option", { value }, value)));
        status.value = row.status;
        const notes = el("textarea", { rows: 2, "aria-label": "ملاحظات المتابعة", disabled: !has(state.context, "website", "write") }, row.internal_notes || "");
        const card = el("article", { class: "website-inbox-card" },
          el("strong", {}, row.id),
          el("p", {}, isComplaint ? row.phone : `${row.customer_name} · ${row.mobile} · ${row.service}`),
          el("p", {}, isComplaint ? row.complaint_text : row.notes),
          el("label", {}, "الحالة", status), el("label", {}, "ملاحظات المتابعة", notes));
        if (has(state.context, "website", "write")) {
          const save = el("button", { type: "button", class: "secondary" }, "حفظ المتابعة");
          save.addEventListener("click", async () => {
            save.disabled = true;
            try {
              const result = await client.from(table).update({ status: status.value, internal_notes: notes.value, updated_at: new Date().toISOString() }).eq("organization_id", org).eq("id", row.id).select("id");
              if (result.error) throw result.error;
              if (!result.data.length) throw new Error("تعذر حفظ المتابعة؛ تحققي من الصلاحيات.");
              notify("تم حفظ المتابعة");
            } catch (error) { showError(error); } finally { save.disabled = false; }
          });
          card.append(save);
        }
        return card;
      }));
    } catch (error) { list.replaceChildren(el("p", {}, "تعذر تحميل السجلات.")); showError(error); }
  })();
  return container;
}


