const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function validOrigin(req) {
  const allowed = String(process.env.PWA_ALLOWED_ORIGIN || '').replace(/\/$/, '');
  return !allowed || req.headers.origin === allowed;
}

function supabaseHeaders() {
  const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (SERVICE_KEY?.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!validOrigin(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: 'push_storage_not_configured' });

  const endpoint = String(req.body?.endpoint || '');
  if (!endpoint.startsWith('https://') || endpoint.length > 2048) return res.status(400).json({ error: 'invalid_endpoint' });

  try {
    const url = new URL('/rest/v1/pwa_push_subscriptions', SUPABASE_URL);
    url.searchParams.set('endpoint', `eq.${endpoint}`);
    url.searchParams.set('welcome_due_at', 'is.null');
    url.searchParams.set('welcome_sent_at', 'is.null');
    const response = await fetch(url, {
      method: 'PATCH',
      headers: supabaseHeaders(),
      body: JSON.stringify({ welcome_due_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() })
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('Welcome schedule database update failed:', response.status, detail.slice(0, 500));
      return res.status(502).json({ error: 'welcome_schedule_failed' });
    }
    const rows = await response.json();
    if (rows.length > 0) return res.status(200).json({ scheduled: true, alreadyScheduled: false });

    const existingUrl = new URL('/rest/v1/pwa_push_subscriptions', SUPABASE_URL);
    existingUrl.searchParams.set('select', 'welcome_due_at,welcome_sent_at');
    existingUrl.searchParams.set('endpoint', `eq.${endpoint}`);
    existingUrl.searchParams.set('limit', '1');
    const existingResponse = await fetch(existingUrl, { headers: supabaseHeaders() });
    if (!existingResponse.ok) return res.status(502).json({ error: 'welcome_status_check_failed' });
    const existing = await existingResponse.json();
    if (!existing.length) return res.status(404).json({ error: 'push_subscription_not_found' });
    const alreadyScheduled = Boolean(existing[0].welcome_due_at || existing[0].welcome_sent_at);
    return res.status(alreadyScheduled ? 200 : 409).json({ scheduled: false, alreadyScheduled, error: alreadyScheduled ? undefined : 'welcome_not_scheduled' });
  } catch (error) {
    console.error('Welcome notification scheduling failed:', error?.message || error);
    return res.status(500).json({ error: 'welcome_schedule_failed' });
  }
};
