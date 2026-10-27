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
    exports, console, Error, crypto: { randomUUID },
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

for (const bookType of ['xlsx', 'biff8', 'csv']) {
  test(`${bookType} actual file bytes: Cyrillic, zeroes, quotes and multiline notes`, () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(employerExportRows(existing)), 'Работодатели')
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType })
    const reopened = XLSX.read(bytes, { type: 'array', raw: true, codepage: 65001, cellDates: false })
    const parsed = parseEmployerRows(XLSX.utils.sheet_to_json(reopened.Sheets[reopened.SheetNames[0]], { header: 1, defval: '', raw: false }))
    for (const { key } of transfer.EMPLOYER_COLUMNS) assert.equal(parsed[0].values[key], existing[0][key] || '')
  })
}
test('stale/unknown explicit ID blocks creation and fallback to another employer', () => {
  for (const eik of ['', existing[0].eik]) {
    assert.equal(planEmployerImport([{ rowNumber: 2, values: { id: 'deleted-id', name: 'Фирма', eik } }], existing, true)[0].operation, 'error')
  }
})
test('invalid email and oversized cells rejected; 5000 rows accepted', () => {
  for (const values of [{ name: 'Тест', email: 'invalid' }, { name: 'Тест', notes: 'x'.repeat(10001) }]) {
    assert.equal(planEmployerImport([{ rowNumber: 2, values }], [], false)[0].operation, 'error')
  }
  assert.equal(parseEmployerRows([['name'], ...Array.from({ length: 5000 }, (_, i) => [`Фирма ${i}`])]).length, 5000)
})
test('duplicate existing EIK, duplicate rows and duplicate target IDs rejected', () => {
  const row = { name: 'Тест', eik: existing[0].eik }
  assert.equal(planEmployerImport([{ rowNumber: 2, values: row }], [...existing, { ...existing[0], id: 'other' }], true)[0].operation, 'error')
  assert.equal(planEmployerImport([row, row].map(values => ({ rowNumber: 2, values })), [], false)[1].operation, 'error')
  assert.equal(planEmployerImport([{ id: existing[0].id, name: 'Едно' }, { id: existing[0].id, name: 'Друго' }].map(values => ({ rowNumber: 2, values })), existing, true)[1].operation, 'error')
})

function mockDb({ role = 'admin', failBatch = 0, concurrentEdit = false } = {}) {
  let documents = existing.map(item => structuredClone(item))
  let signedIn = true
  const auth = { authStateReady: async () => {}, get currentUser() { return signedIn ? { uid: 'admin', email: 'admin@example.com' } : null } }
  const writes = []
  let batchNumber = 0
  const data = {
    getAppDocument: async collection => collection === 'users' ? { displayName: 'Админ', role } : null,
    getAppDocuments: async collection => collection === 'employers' ? documents : [],
    insertAppDocument: async () => {},
    replaceAppDocumentIfUnchanged: async (collection, id, value, expectedUpdatedAt) => {
      const current = documents.find(row => row.id === id)
      if (concurrentEdit) {
        current.updatedAt = 'newer-version'
        current.positions = [{ id: 'new-position', title: 'Нова позиция' }]
      }
      if (!current || current.updatedAt !== expectedUpdatedAt) throw new Error('Работодателят е променен')
      writes.push({ collection_name: collection, id, data: value })
      documents = documents.map(row => row.id === id ? { id, ...value } : row)
    },
    upsertAppDocuments: async items => {
      batchNumber++
      if (batchNumber === failBatch) throw new Error('Simulated failure')
      writes.push(...items)
      for (const item of items) documents = [...documents.filter(row => row.id !== item.id), { id: item.id, ...item.data }]
    },
  }
  const db = loadTs('lib/db.ts', {
    './firebase': { auth },
    './employer-transfer': transfer,
    './beneficiary-photo-storage': {},
    './app-data': data,
  })
  return { db, writes, setRole: value => { role = value }, signOut: () => { signedIn = false }, documents: () => documents }
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

  const conflict = mockDb({ concurrentEdit: true })
  await assert.rejects(() => conflict.db.importEmployers([{ rowNumber: 2, values: { id: 'employer-1', name: 'Обновена' } }], true), /променен/)
  assert.equal(conflict.writes.length, 0)
  assert.equal(conflict.documents()[0].positions[0].title, 'Нова позиция')
  tests++; console.log('PASS concurrent position edit stops import without overwriting it')

  const denied = mockDb({ role: 'user' })
  await assert.rejects(() => denied.db.importEmployers([{ rowNumber: 2, values: { name: 'Фирма' } }]), /администратор/)
  assert.equal(denied.writes.length, 0)
  tests++; console.log('PASS non-admin denied before writes')

  for (const role of ['user', 'editor']) {
    const revoked = mockDb()
    await revoked.db.currentAccess() // populate the UI cache while still admin
    revoked.setRole(role)
    await assert.rejects(() => revoked.db.importEmployers([{ rowNumber: 2, values: { name: 'Тест' } }]), /администратор/)
    assert.equal(revoked.writes.length, 0)
    tests++; console.log(`PASS cached admin revoked to ${role} denied before writes`)
  }
  const signedOut = mockDb()
  signedOut.signOut()
  await assert.rejects(() => signedOut.db.importEmployers([{ rowNumber: 2, values: { name: 'Тест' } }]), /вход/)
  assert.equal(signedOut.writes.length, 0)
  tests++; console.log('PASS signed-out import denied')

  const create = mockDb()
  await create.db.importEmployers([{ rowNumber: 2, values: { name: 'Нова', phone: '0888123456', eik: '000123456', createdByUid: 'injected' } }])
  assert.equal(create.writes[0].collection_name, 'employers')
  assert.equal(create.writes[0].data.createdByUid, 'admin')
  assert.equal(create.writes[0].data.phone, '0888123456')
  assert.deepEqual(create.documents().find(row => row.id === existing[0].id), existing[0])
  tests++; console.log('PASS create uses current owner and leaves existing records unchanged')

  const skip = mockDb()
  assert.equal((await skip.db.importEmployers(parseEmployerRows(employerExportRows(existing)))).skipped, 1)
  assert.equal(skip.writes.length, 0)
  tests++; console.log('PASS default duplicate import performs no employer writes')

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
  const { createClient } = require('@supabase/supabase-js')
  let responseRows = [{ id: 'employer-1' }]
  let responseError = false
  const requests = []
  const client = createClient('https://test.invalid', 'test-publishable-key', {
    auth: { persistSession: false },
    global: { fetch: async (url, init) => {
      requests.push({ url: String(url), method: init.method, body: JSON.parse(init.body) })
      return new Response(JSON.stringify(responseError ? { message: 'RLS denied', code: '42501' } : responseRows), { status: responseError ? 403 : 200, headers: { 'Content-Type': 'application/json' } })
    } },
  })
  const appData = loadTs('lib/app-data.ts', { './supabase': { supabase: client } })
  const value = { name: 'Обновена', positions: existing[0].positions, updatedAt: 'new' }
  await appData.replaceAppDocumentIfUnchanged('employers', 'employer-1', value, existing[0].updatedAt)
  assert.equal(requests[0].method, 'PATCH')
  const url = new URL(requests[0].url)
  assert.equal(url.searchParams.get('collection_name'), 'eq.employers')
  assert.equal(url.searchParams.get('id'), 'eq.employer-1')
  assert.equal(url.searchParams.get('data->>updatedAt'), 'eq.' + existing[0].updatedAt)
  assert.equal(url.searchParams.get('select'), 'id')
  assert.deepEqual(requests[0].body, { data: value })
  tests++; console.log('PASS real Supabase request builder sends conditional PATCH and checks affected IDs')
  responseRows = []
  await assert.rejects(() => appData.replaceAppDocumentIfUnchanged('employers', 'employer-1', value), /променен, изтрит или недостъпен/)
  assert.equal(new URL(requests[1].url).searchParams.get('data->>updatedAt'), 'is.null')
  tests++; console.log('PASS missing legacy timestamp uses null filter; zero affected rows stop import')
  responseError = true
  await assert.rejects(() => appData.replaceAppDocumentIfUnchanged('employers', 'employer-1', value), /RLS denied/)
  tests++; console.log('PASS conditional update propagates database permission errors')
  console.log(`${tests} tests passed`)
}
integrationTests().catch(error => { console.error(error); process.exitCode = 1 })
