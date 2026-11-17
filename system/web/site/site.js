const config = globalThis.RENTAL_CONFIG;
if (config?.supabaseUrl && config?.supabasePublishableKey && globalThis.supabase) {
  const client = globalThis.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const { data, error } = await client.from("website_published_content").select("headline,subhead").limit(2);
  if (!error && data?.length === 1) {
    if (data[0].headline) document.querySelector("#headline").textContent = data[0].headline;
    if (data[0].subhead) document.querySelector("#subhead").textContent = data[0].subhead;
  }
}
