const config = globalThis.RENTAL_CONFIG;
const client = config?.supabaseUrl && config?.supabasePublishableKey && globalThis.supabase
  ? globalThis.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
if (client) {
  const { data, error } = await client.from("website_published_content").select("headline,subhead").limit(2);
  if (!error && data?.length === 1) {
    if (data[0].headline) document.querySelector("#headline").textContent = data[0].headline;
    if (data[0].subhead) document.querySelector("#subhead").textContent = data[0].subhead;
  }
}
for (const [id, rpc, fields] of [
  ["request-form", "submit_website_request", {name:"p_name",mobile:"p_mobile",service:"p_service",notes:"p_notes"}],
  ["complaint-form", "submit_website_complaint", {phone:"p_phone",text:"p_text"}],
]) {
  const form = document.getElementById(id), status = form.querySelector('[role="status"]'), submit = form.querySelector('button');
  if (!client) { submit.disabled = true; status.textContent = "الخدمة غير متاحة حالياً."; continue; }
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
