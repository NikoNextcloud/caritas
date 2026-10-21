const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { randomUUID } = require('node:crypto')
const ts = require('typescript')
const XLSX = require('xlsx')

function loadTs(relativePath, dependencies = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports, console, crypto: { randomUUID },
    require: name => {
      if (!(name in dependencies)) throw new Error(`Unmocked dependency: ${name}`)
      return dependencies[name]
    },
  }, { filename })
  return exports
}

const transfer = loadTs('lib/employer-transfer.ts')
const { employerExportRows, parseEmployerRows, planEmployerImport, employerImportPatch } = transfer
const existing = [{
  id: 'employer-1', name: 'Фирма А', eik: '001234567', city: 'София', phone: '0888123456',
  email: 'office@example.com', address: 'ул. Тест 1', contactPerson: 'Мария', industry: 'Услуги', notes: 'Бележки, с „кирилица“',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  createdByUid: 'original-owner', assignedToUid: 'assigned-user', positions: [{ id: '1', title: 'Шофьор', isActive: true }],
}]
const plain = value => JSON.parse(JSON.stringify(value))
let tests = 0
function test(name, callback) { callback(); tests++; console.log(`PASS ${name}`) }

test('all employer columns export/import round trip and leading zeroes', () => {
  const rows = parseEmployerRows(employerExportRows(existing))
  for (const { key } of transfer.EMPLOYER_COLUMNS) assert.equal(rows[0].values[key], existing[0][key] || '')
  assert.equal(rows[0].values.phone, '0888123456')
  assert.equal(rows[0].values.eik, '001234567')
})
test('xlsx binary round trip keeps values as text without formulas', () => {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(employerExportRows([{ ...existing[0], notes: '=HYPERLINK("https://example.com")' }]))
  assert.equal(sheet.J2.t, 's')
  assert.equal(sheet.J2.f, undefined)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Работодатели')
  const reopened = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
  const parsed = parseEmployerRows(XLSX.utils.sheet_to_json(reopened.Sheets['Работодатели'], { header: 1, defval: '', raw: false }))
  assert.equal(parsed[0].values.phone, '0888123456')
  assert.equal(parsed[0].values.eik, '001234567')
  assert.equal(parsed[0].values.notes, '=HYPERLINK("https://example.com")')
})
test('CSV semicolon, quoted commas, Cyrillic and newlines', () => {
  const workbook = XLSX.read('\uFEFFНаименование;Телефон;Бележки\n"Нова фирма";"0888123000";"ред 1, бележка\nред 2"', { type: 'string', raw: true })
  const parsed = parseEmployerRows(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false }))
  assert.equal(parsed[0].values.phone, '0888123000')
  assert.equal(parsed[0].values.notes, 'ред 1, бележка\nред 2')
})
test('Bulgarian/English aliases, title rows and empty rows', () => {
  const parsed = parseEmployerRows([['Списък'], ['Company Name', 'E-mail', 'Булстат', 'Contact Person'], [], ['Фирма', 'x@example.com', '00123', 'Иван']])
  assert.equal(parsed[0].rowNumber, 4)
  assert.equal(parsed[0].values.eik, '00123')
  assert.equal(parsed[0].values.contactPerson, 'Иван')
})
test('reject missing/duplicate columns, empty files and oversized imports', () => {
  assert.throws(() => parseEmployerRows([['Телефон'], ['123']]), /Наименование/)
  assert.throws(() => parseEmployerRows([['Име', 'name'], ['А', 'А']]), /повторени/)
  assert.throws(() => parseEmployerRows([['Наименование']]), /не съдържа/)
  assert.throws(() => parseEmployerRows([['name'], ...Array.from({ length: 5001 }, () => ['Фирма'])]), /5000/)
})
test('existing rows skipped by default; update explicitly enabled', () => {
  const rows = parseEmployerRows(employerExportRows(existing))
  assert.equal(planEmployerImport(rows, existing, false)[0].operation, 'skip')
  assert.equal(planEmployerImport(rows, existing, true)[0].operation, 'update')
})
test('match by EIK or name/city; missing fields do not clear data', () => {
  const plan = planEmployerImport([{ rowNumber: 2, values: { name: 'Ново име', eik: '001234567', phone: '' } }], existing, true)
  assert.equal(plan[0].existingId, 'employer-1')
  const patch = employerImportPatch(plan[0].values)
  assert.equal(patch.phone, undefined)
  assert.equal(planEmployerImport([{ rowNumber: 2, values: { name: 'Фирма А', city: 'София' } }], existing, true)[0].existingId, 'employer-1')
})
test('reject duplicate file rows, including rows with and without EIK', () => {
  const row = { name: 'Нова', city: 'Пловдив', eik: '123' }
  for (const reverse of [false, true]) {
    const values = [row, { name: 'Нова', city: 'Пловдив' }]
    if (reverse) values.reverse()
    assert.equal(planEmployerImport(values.map((value, i) => ({ rowNumber: i + 2, values: value })), [], false)[1].operation, 'error')
  }
})
test('reject conflicting IDs, duplicate EIK and ambiguous name matches', () => {
  const other = { ...existing[0], id: 'other', name: 'Друга', eik: '999' }
  assert.equal(planEmployerImport([{ rowNumber: 2, values: { id: 'other', name: 'Фирма А', eik: '001234567' } }], [...existing, other], true)[0].operation, 'error')
  assert.equal(planEmployerImport([{ rowNumber: 2, values: { name: 'Фирма А', city: 'София' } }], [...existing, { ...existing[0], id: 'duplicate' }], true)[0].operation, 'error')
})
test('only approved fields accepted, no IDs/ownership/positions injected', () => {
  const patch = employerImportPatch({ name: 'Фирма', id: 'injected', role: 'admin', createdByUid: 'bad', assignedToUid: 'bad', positions: [] })
  assert.deepEqual(plain(patch), { name: 'Фирма' })
})

function mockDb({ role = 'admin', failBatch = 0 } = {}) {
  let documents = existing.map(item => ({ ...item }))
  const writes = []
  let batchNumber = 0
  const data = {
    getAppDocument: async collection => collection === 'users' ? { displayName: 'Админ', role } : null,
    getAppDocuments: async collection => collection === 'employers' ? documents : [],
    insertAppDocument: async () => {},
    upsertAppDocuments: async items => {
      batchNumber++
      if (batchNumber === failBatch) throw new Error('Simulated failure')
      writes.push(...items)
      for (const item of items) documents = [...documents.filter(row => row.id !== item.id), { id: item.id, ...item.data }]
    },
  }
  const db = loadTs('lib/db.ts', {
    './firebase': { auth: { authStateReady: async () => {}, currentUser: { uid: 'admin', email: 'admin@example.com' } } },
    './employer-transfer': transfer,
    './beneficiary-photo-storage': {},
    './app-data': data,
  })
  return { db, writes }
}

async function integrationTests() {
  const { db, writes } = mockDb()
  const result = await db.importEmployers([{ rowNumber: 2, values: { id: 'employer-1', name: 'Обновена', phone: '' } }], true)
  assert.equal(result.updated, 1)
  assert.equal(writes[0].data.phone, '0888123456')
  assert.equal(writes[0].data.createdByUid, 'original-owner')
  assert.equal(writes[0].data.assignedToUid, 'assigned-user')
  assert.equal(writes[0].data.positions[0].title, 'Шофьор')
  assert.equal(writes[0].data.createdAt, existing[0].createdAt)
  tests++; console.log('PASS update preserves ownership, positions and blank fields')

  const denied = mockDb({ role: 'user' })
  await assert.rejects(() => denied.db.importEmployers([{ rowNumber: 2, values: { name: 'Фирма' } }]), /администратор/)
  assert.equal(denied.writes.length, 0)
  tests++; console.log('PASS non-admin denied before writes')

  const invalid = mockDb()
  await assert.rejects(() => invalid.db.importEmployers([{ rowNumber: 2, values: { name: '' } }]), /Ред 2/)
  assert.equal(invalid.writes.length, 0)
  tests++; console.log('PASS validation errors block all writes')

  const partial = mockDb({ failBatch: 2 })
  const manyRows = Array.from({ length: 101 }, (_, i) => ({ rowNumber: i + 2, values: { name: `Фирма ${i}` } }))
  await assert.rejects(() => partial.db.importEmployers(manyRows), /Записани: 100 нови и 0 обновени/)
  assert.equal(partial.writes.length, 100)
  const retry = await partial.db.importEmployers(manyRows)
  assert.equal(retry.created, 1)
  assert.equal(retry.skipped, 100)
  tests++; console.log('PASS batch failure reports partial result; retry skips saved rows')
  console.log(`${tests} tests passed`)
}
integrationTests().catch(error => { console.error(error); process.exitCode = 1 })
