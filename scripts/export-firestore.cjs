const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT;
const outputDir = process.env.FIRESTORE_EXPORT_DIR;

if (!keyPath || !outputDir) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT and FIRESTORE_EXPORT_DIR are required');
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

function serialize(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return { __type: 'reference', path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __type: 'bytes', value: Buffer.from(value).toString('base64') };
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const db = admin.firestore();
  const collections = await db.listCollections();
  const manifest = { projectId: serviceAccount.project_id, exportedAt: new Date().toISOString(), collections: {} };

  for (const collection of collections.sort((a, b) => a.id.localeCompare(b.id))) {
    const outputPath = path.join(outputDir, `${collection.id}.ndjson`);
    const stream = fs.createWriteStream(outputPath, { mode: 0o600 });
    let count = 0;
    let nestedCollections = 0;
    let cursor = null;
    while (true) {
      let query = collection.orderBy(admin.firestore.FieldPath.documentId()).limit(200);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      for (const document of snapshot.docs) {
        stream.write(`${JSON.stringify({ id: document.id, data: serialize(document.data()) })}\n`);
        count += 1;
      }
      cursor = snapshot.docs.at(-1);
      console.log(`${collection.id}: ${count} exported`);
      if (snapshot.size < 200) break;
    }
    await new Promise((resolve, reject) => stream.end(resolve).on('error', reject));
    manifest.collections[collection.id] = { count, nestedCollections };
    console.log(`${collection.id}: ${count}`);
  }

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(`TOTAL: ${Object.values(manifest.collections).reduce((sum, item) => sum + item.count, 0)}`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
