const crypto = require('node:crypto');
const webpush = require('web-push');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
function adminHeaders(prefer) {
  const headers = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (SERVICE_KEY?.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  if (prefer) headers.Prefer = prefer;
  return headers;
}

function authorized(req) {
  const expected = process.env.PWA_PUSH_WEBHOOK_SECRET || '';
  const received = String(req.headers['x-pwa-webhook-secret'] || '');
  return Boolean(expected && expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received)));
}

function riyadhDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

const messages = {
  morning: [
    ['خيارات تهمّ بيتك', 'تدورين عاملة مناسبة؟ شوفي الملفات المتاحة وخذي راحتك بالاختيار.'],
    ['خلّينا نسهّلها عليك', 'تصفّحي العاملات المتاحات من جوالك، وإذا لقيتي اللي يناسبك ارسلي طلبك.'],
    ['اختاري براحتك', 'خبرات وجنسيات مختلفة بانتظارك في التطبيق.. شوفي الخيارات المتاحة اليوم.'],
    ['خيارك أقرب لك', 'افتحي التطبيق وتعرّفي على ملفات العاملات المتاحات من الركائز البشرية.'],
    ['يمكن تلقين اللي يناسبك', 'خذي جولة سريعة على العاملات المتاحات واختاري حسب احتياج بيتك.'],
    ['نساعدك تختارين', 'شوفي بيانات العاملات وخبراتهن، وفريقنا جاهز يجاوبك عن أي استفسار.'],
    ['ابدئي بخطوة بسيطة', 'تصفّحي الملفات المتاحة اليوم، وقدّمي طلبك بكل سهولة من التطبيق.']
  ],
  afternoon: [
    ['تأجير شهري براحة أكبر', 'خدمة التأجير خيار مرن لبيتك.. شوفي الباقات والتفاصيل في التطبيق.'],
    ['خيار مرن لاحتياج بيتك', 'استكشفي خدمة التأجير الشهري، وإذا عندك سؤال فريقنا حاضر.'],
    ['خلّي الخدمة على قد احتياجك', 'تعرّفي على باقات التأجير الشهري واختاري المدة المناسبة لك.'],
    ['التأجير صار أقرب', 'افتحي التطبيق وشوفي خيارات التأجير الشهري من الركائز البشرية.'],
    ['راحة ومرونة لبيتك', 'خذي فكرة عن خدمة التأجير وباقاتها، والتفاصيل تلقينها داخل التطبيق.'],
    ['تحتاجين مساعدة لفترة؟', 'شوفي خدمة التأجير الشهري وخياراتها، وقدّمي طلبك من التطبيق.'],
    ['اختاري اللي يناسبك', 'باقات التأجير الشهري موجودة بالتطبيق.. تصفّحيها على راحتك.']
  ],
  evening: [
    ['مساء الخير من الركائز', 'خدمات الاستقدام والتأجير بانتظارك.. افتحي التطبيق وتصفّحيها براحتك.'],
    ['مساءك راحة', 'خذي جولة على العاملات المتاحات وباقات التأجير من تطبيقنا.'],
    ['كل خدماتنا بمكان واحد', 'استقدام أو تأجير شهري؟ شوفي التفاصيل وقدّمي طلبك من التطبيق.'],
    ['نورتينا اليوم؟', 'إذا ما شفتي الجديد، افتحي التطبيق وتعرّفي على خدمات الركائز.'],
    ['وقتك يهمّنا', 'تصفّحي خدمات البيت من جوالك، وفريق الركائز قريب منك لأي استفسار.'],
    ['اختاري الخدمة المناسبة', 'العاملات المتاحات وباقات التأجير تلقينها في تطبيق الركائز.'],
    ['خلي خيارات بيتك أقرب', 'افتحي التطبيق وشوفي الاستقدام والتأجير الشهري بكل سهولة.']
  ]
};

const destinations = { morning: '/index.html?view=workers', afternoon: '/index.html?view=rental', evening: '/index.html?view=home' };
const topics = { morning: 'workers', afternoon: 'rental', evening: 'all' };

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  if (!SUPABASE_URL || !SERVICE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return res.status(503).json({ error: 'push_not_configured' });

  const slot = String(req.body?.slot || '');
  if (!messages[slot]) return res.status(400).json({ error: 'invalid_campaign_slot' });
  const { year, month, day } = riyadhDate();
  const date = `${year}-${month}-${day}`;
  const campaignKey = `${date}:${slot}`;

  try {
    const claim = await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_campaign_runs?on_conflict=campaign_key`, {
      method: 'POST',
      headers: adminHeaders('resolution=ignore-duplicates,return=representation'),
      body: JSON.stringify({ campaign_key: campaignKey, slot })
    });
    if (!claim.ok) return res.status(502).json({ error: 'campaign_claim_failed' });
    const claimed = await claim.json();
    if (!claimed.length) return res.status(200).json({ skipped: 'already_sent', campaign: campaignKey });

    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const topic = topics[slot];
    const filter = topic === 'workers' ? '&notify_workers=eq.true' : topic === 'rental' ? '&notify_rental=eq.true' : '&or=(notify_workers.eq.true,notify_rental.eq.true)';
    const subscriptionResult = await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?select=endpoint,p256dh,auth${filter}`, { headers: adminHeaders() });
    if (!subscriptionResult.ok) return res.status(502).json({ error: 'subscription_list_failed' });
    const subscriptions = await subscriptionResult.json();
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const [title, body] = messages[slot][weekday];
    const payload = JSON.stringify({ title, body, url: destinations[slot], tag: `daily-${date}-${slot}`, lang: 'ar', dir: 'rtl' });
    let sent = 0, failed = 0;
    await Promise.all(subscriptions.map(async subscription => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 60 * 60 * 12 });
        sent++;
      } catch (error) {
        failed++;
        if (error.statusCode === 404 || error.statusCode === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, { method: 'DELETE', headers: adminHeaders() });
        }
      }
    }));
    await fetch(`${SUPABASE_URL}/rest/v1/pwa_push_campaign_runs?campaign_key=eq.${encodeURIComponent(campaignKey)}`, {
      method: 'PATCH',
      headers: adminHeaders('return=minimal'),
      body: JSON.stringify({ sent, failed, subscriber_count: subscriptions.length })
    });
    return res.status(200).json({ campaign: campaignKey, sent, failed, total: subscriptions.length });
  } catch (error) {
    console.error('Daily push campaign failed:', error?.message || error);
    return res.status(500).json({ error: 'daily_push_failed' });
  }
};
