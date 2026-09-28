const fs = require('node:fs');
const path = require('node:path');

const [exportDir, collectionName, offsetText, limitText] = process.argv.slice(2);
const offset = Number(offsetText);
const limit = Number(limitText);

if (!exportDir || !/^[A-Za-z0-9_-]+$/.test(collectionName || '') || !Number.isInteger(offset) || !Number.isInteger(limit)) {
  throw new Error('Usage: render-supabase-batch.cjs <export-dir> <collection> <offset> <limit>');
}

const inputPath = path.join(exportDir, `${collectionName}.ndjson`);
const lines = fs.readFileSync(inputPath, 'utf8').split('\n').filter(Boolean).slice(offset, offset + limit);
if (!lines.length) process.exit(0);

function sqlText(value) {
  return `convert_from(decode('${Buffer.from(String(value), 'utf8').toString('base64')}','base64'),'utf8')`;
}

const values = lines.map(line => {
  const row = JSON.parse(line);
  return `(${sqlText(collectionName)},${sqlText(row.id)},${sqlText(JSON.stringify(row.data))}::jsonb)`;
});

process.stdout.write(`insert into public.app_documents (collection_name,id,data) values\n${values.join(',\n')}\non conflict (collection_name,id) do update set data=excluded.data;`);
