const config = globalThis.RENTAL_CONFIG;
const client = config?.supabaseUrl && config?.supabasePublishableKey && globalThis.supabase
  ? globalThis.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
let siteReady = false;
if (client) {
  const { data, error } = await client.from("website_published_content").select("organization_id,headline,subhead").limit(2);
  if (!error && data?.length === 1) {
    siteReady = true;
    if (data[0].headline) document.querySelector("#headline").textContent = data[0].headline;
    if (data[0].subhead) document.querySelector("#subhead").textContent = data[0].subhead;
    const workers = await client.from("website_published_workers").select("ref,nationality,profession,age,experience,photo_path").eq("organization_id", data[0].organization_id).limit(100);
    const cards = document.querySelector("#worker-cards");
    if (workers.error) cards.textContent = "تعذر تحميل البطاقات حالياً.";
    else if (!workers.data.length) cards.textContent = "لا توجد بطاقات متاحة حالياً.";
    else cards.replaceChildren(...await Promise.all(workers.data.map(async worker => {
      const card = document.createElement("article");
      if (worker.photo_path) {
        const photo = await client.storage.from("website-worker-photos").createSignedUrl(worker.photo_path, 120);
        if (!photo.error && photo.data?.signedUrl) {
          const image = document.createElement("img");
          image.src = photo.data.signedUrl; image.alt = "صورة بطاقة العاملة"; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
          card.append(image);
        }
      }
      for (const value of [worker.ref, worker.profession, worker.nationality, worker.age, worker.experience]) {
        if (!value) continue; const line = document.createElement("p"); line.textContent = value; card.append(line);
      }
      return card;
    })));
  } else document.querySelector("#worker-cards").textContent = "لا توجد بطاقات متاحة حالياً.";
} else document.querySelector("#worker-cards").textContent = "لا توجد بطاقات متاحة حالياً.";
for (const [id, rpc, fields] of [
  ["request-form", "submit_website_request", {name:"p_name",mobile:"p_mobile",service:"p_service",notes:"p_notes"}],
  ["complaint-form", "submit_website_complaint", {phone:"p_phone",text:"p_text"}],
]) {
  const form = document.getElementById(id), status = form.querySelector('[role="status"]'), submit = form.querySelector('button');
  if (!client || !siteReady) { submit.disabled = true; status.textContent = "استقبال الطلبات غير متاح حالياً."; continue; }
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    submit.disabled = true; status.textContent = "جارٍ الإرسال…";
    try {
      const values = new FormData(form), args = Object.fromEntries(Object.entries(fields).map(([field,key]) => [key, values.get(field)]));
      const { data, error } = await client.rpc(rpc, args);
      if (error) throw error;
      form.reset(); status.textContent = `تم الإرسال بنجاح. رقم المتابعة: ${data}`;
    } catch { status.textContent = "تعذر الإرسال حالياً. حاولي مرة أخرى لاحقاً."; }
    finally { submit.disabled = false; }
  });
}

