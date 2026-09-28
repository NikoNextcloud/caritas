const fs = require('node:fs');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, 'utf8'));
const users = fs.readFileSync(`${process.env.FIRESTORE_EXPORT_DIR}/users.ndjson`, 'utf8')
  .split('\n').filter(Boolean).map(JSON.parse);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function firebaseIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.FIREBASE_WEB_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Firebase token exchange failed: ${response.status}`);
  return (await response.json()).idToken;
}

async function count(token, collectionName) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/app_documents?collection_name=eq.${collectionName}&select=id`, {
    method: 'HEAD',
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      prefer: 'count=exact',
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  return Number((response.headers.get('content-range') || '/0').split('/')[1]);
}

async function verify(label, record) {
  if (!record) return;
  const token = await firebaseIdToken(record.id);
  console.log(`${label}: users=${await count(token, 'users')}, beneficiaries=${await count(token, 'beneficiaries')}, auditLogs=${await count(token, 'auditLogs')}`);
}

(async () => {
  await verify('admin', users.find(row => row.data.role === 'admin'));
  await verify('user', users.find(row => row.data.role !== 'admin'));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
