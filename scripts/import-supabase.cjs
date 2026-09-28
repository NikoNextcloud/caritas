const fs = require('node:fs');
const path = require('node:path');

const exportDir = process.env.FIRESTORE_EXPORT_DIR;
const migrationToken = process.env.SUPABASE_MIGRATION_TOKEN;
const projectUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const batchSize = Number(process.env.IMPORT_BATCH_SIZE || 400);

if (!exportDir || !migrationToken || !projectUrl || !publishableKey) {
  throw new Error('Missing migration environment variables');
}

async function send(rows) {
  const response = await fetch(`${projectUrl}/rest/v1/rpc/migration_upsert_documents`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${publishableKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_token: migrationToken, p_rows: rows }),
  });
  if (!response.ok) throw new Error(`Supabase import failed (${response.status}): ${await response.text()}`);
  return Number(await response.json());
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(exportDir, 'manifest.json'), 'utf8'));
  let total = 0;
  for (const [collectionName, details] of Object.entries(manifest.collections)) {
    const lines = fs.readFileSync(path.join(exportDir, `${collectionName}.ndjson`), 'utf8').split('\n').filter(Boolean);
    for (let offset = 0; offset < lines.length; offset += batchSize) {
      const rows = lines.slice(offset, offset + batchSize).map(line => {
        const record = JSON.parse(line);
        return { collection_name: collectionName, id: record.id, data: record.data };
      });
      total += await send(rows);
      console.log(`${collectionName}: ${Math.min(offset + batchSize, lines.length)}/${details.count}`);
    }
  }
  console.log(`IMPORTED: ${total}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
