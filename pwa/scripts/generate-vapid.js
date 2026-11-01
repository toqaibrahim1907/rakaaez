const fs = require('node:fs');
const path = require('node:path');
const webpush = require('web-push');

const output = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(output)) {
  console.error('pwa/.env.local already exists; move it aside before creating a new key pair.');
  process.exit(1);
}

const keys = webpush.generateVAPIDKeys();
const contents = [
  'VAPID_PUBLIC_KEY=' + keys.publicKey,
  'VAPID_PRIVATE_KEY=' + keys.privateKey,
  'VAPID_SUBJECT=mailto:info@alrkayzb2.com',
  ''
].join('\n');
fs.writeFileSync(output, contents, { flag: 'wx', mode: 0o600 });
console.log('Generated VAPID keys in pwa/.env.local. Copy these values to the PWA Vercel project Environment Variables; do not commit this file.');
