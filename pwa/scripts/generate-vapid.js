const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const webpush = require('web-push');

const output = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(output)) {
  const existing = fs.readFileSync(output, 'utf8');
  if (/^PWA_PUSH_WEBHOOK_SECRET=/m.test(existing)) {
    console.error('PWA_PUSH_WEBHOOK_SECRET is already present in pwa/.env.local; keeping all existing keys unchanged.');
    process.exit(1);
  }
  const webhookSecret = crypto.randomBytes(48).toString('base64url');
  fs.appendFileSync(output, `\nPWA_PUSH_WEBHOOK_SECRET=${webhookSecret}\n`, { mode: 0o600 });
  console.log('Added the webhook secret to the existing pwa/.env.local without changing its current keys.');
} else {
  const keys = webpush.generateVAPIDKeys();
  const webhookSecret = crypto.randomBytes(48).toString('base64url');
  const contents = [
    'VAPID_PUBLIC_KEY=' + keys.publicKey,
    'VAPID_PRIVATE_KEY=' + keys.privateKey,
    'VAPID_SUBJECT=mailto:info@alrkayzb2.com',
    'PWA_PUSH_WEBHOOK_SECRET=' + webhookSecret,
    ''
  ].join('\n');
  fs.writeFileSync(output, contents, { flag: 'wx', mode: 0o600 });
  console.log('Generated PWA notification secrets in pwa/.env.local. Add them to Vercel; do not commit this file.');
}
