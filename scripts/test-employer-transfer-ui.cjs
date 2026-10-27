// Optional DOM component check: requires jsdom (npm install --no-save jsdom).
// Uses the real component, React and XLSX; DB and downloads stay in memory.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM, VirtualConsole } = require('jsdom')
const ts = require('typescript')
const XLSX = require('xlsx')
const root = path.resolve(__dirname, '..')
const sources = {
  transfer: 'lib/employer-transfer.ts',
  modal: 'components/ui/Modal.tsx',
  component: 'app/admin/employers/EmployerTransfer.tsx',
}
const modules = Object.entries(sources).map(([id, file]) => {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  return `factories[${JSON.stringify(id)}] = function(require,exports){${code}\n};`
}).join('\n')
const html = `<!doctype html><html><body><div id="root"></div>
<script>${fs.readFileSync(path.join(path.dirname(require.resolve('react')), 'umd/react.production.min.js'),'utf8')}</script>
<script>${fs.readFileSync(path.join(path.dirname(require.resolve('react-dom')), 'umd/react-dom.production.min.js'),'utf8')}</script>
<script>${fs.readFileSync(path.join(path.dirname(require.resolve('xlsx')), 'dist/xlsx.full.min.js'),'utf8')}</script>
<script>
const fake = { isAdmin: true, writes: 0 };
const employers = Array.from({length:120}, (_,i)=>({id:'id-'+i,name:'Фирма '+i,eik:'00123'+i,phone:'0888123456',city:'София'}));
const factories = {}, cache = {};
${modules}
function require(name) {
  if(name==='react') return React;
  if(name==='react/jsx-runtime') return {Fragment:React.Fragment,jsx:(t,p,k)=>React.createElement(t,{...p,key:k}),jsxs:(t,p,k)=>React.createElement(t,{...p,key:k})};
  if(name==='lucide-react') return {Download:()=>null,FileSpreadsheet:()=>null,Upload:()=>null,X:()=>null};
  if(name==='react-hot-toast') return {__esModule:true,default:{success:()=>{},error:()=>{}}};
  if(name==='xlsx') return XLSX;
  if(name==='@/lib/db') return {currentAccess:async()=>({isAdmin:fake.isAdmin}),importEmployers:async()=>{fake.writes++;throw Error('Unexpected import write')}};
  const id = {'@/components/ui/Modal':'modal','@/lib/employer-transfer':'transfer'}[name]||name;
  if(!cache[id]) {cache[id]={};factories[id](require,cache[id]);} return cache[id];
}
const Component = require('component').default;
const app = ReactDOM.createRoot(document.getElementById('root'));
window.mount = (admin=true,loading=false)=>{fake.isAdmin=admin;app.render(React.createElement(Component,{key:String(admin)+loading,employers,exportEmployers:employers,loading,onChanged:async()=>{}}));};
window.getWrites=()=>fake.writes;
mount();
</script></body></html>`

let checks=0
function pass(name) {checks++; console.log('PASS '+name)}
async function main() {
  const errors=[]
  const vc=new VirtualConsole()
  vc.on('jsdomError', e=>errors.push(e.message))
  const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc})
  const w=dom.window, d=w.document
  const delay=()=>new Promise(resolve=>setTimeout(resolve,10))
  async function waitFor(check) {
    for(let i=0;i<200;i++) {if(check())return;await delay()}
    throw Error('DOM timeout: '+d.getElementById('root').textContent.slice(-2500)+' errors: '+errors.join(';'))
  }
  const button=name=>Array.from(d.querySelectorAll('button')).find(b=>b.textContent.trim()===name)
  const importButton=()=>Array.from(d.querySelectorAll('button')).find(b=>b.textContent.startsWith('Импортирай'))
  async function upload(buffer,name='test.csv') {
    const input=d.querySelector('input[type=file]')
    Object.defineProperty(input,'files',{configurable:true,value:[{name,size:buffer.length,arrayBuffer:async()=>w.Uint8Array.from(buffer).buffer}]})
    input.dispatchEvent(new w.Event('change',{bubbles:true}))
    await waitFor(()=>button('Избери файл') && !button('Избери файл').disabled)
  }
  try {
    await waitFor(()=>button('Импорт'))
    button('Импорт').click()
    await waitFor(()=>button('Избери файл'))
    for(const [extension,bookType] of [['xlsx','xlsx'],['xls','biff8'],['csv','csv']]) {
      const book=XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Наименование','Телефон','ЕИК'],['Тест „Кирилица“','0888123456','000123456']]),'Работодатели')
      await upload(XLSX.write(book,{type:'buffer',bookType}),'test.'+extension)
      assert.match(d.getElementById('root').textContent,/Общо: 1 · Нови: 1/)
      assert.match(d.getElementById('root').textContent,/0888123456/)
      assert.match(d.getElementById('root').textContent,/000123456/)
      assert.match(d.getElementById('root').textContent,/Тест „Кирилица“/)
      assert.equal(importButton().disabled,false)
      pass(extension+' upload preview preserves Cyrillic and zeroes')
    }
    const csv=contents=>upload(Buffer.from('\uFEFF'+contents))
    await csv('ID;Наименование;ЕИК\nid-0;Фирма 0;001230')
    assert.match(d.getElementById('root').textContent,/Пропуснати: 1/)
    assert.equal(importButton().disabled,true)
    d.querySelector('input[type=checkbox]').click()
    await waitFor(()=>d.getElementById('root').textContent.includes('За обновяване: 1'))
    assert.equal(importButton().disabled,false)
    pass('skip by default and explicit update toggle')
    for(const [contents,message] of [
      ['Наименование;Имейл\nТест;invalid','Невалиден имейл'],
      ['Наименование;ЕИК\nТест;123\nТест;123','Повторен работодател'],
      ['Наименование;Телефон\n;0888000000','Липсва наименование'],
      ['ID;Наименование\ndeleted;Тест','ID не съществува'],
    ]) {
      await csv(contents)
      assert.ok(d.getElementById('root').textContent.includes(message))
      assert.equal(importButton().disabled,true)
    }
    pass('duplicate, invalid email, missing name and stale ID block the UI')
    await upload(Buffer.from('test'),'test.txt')
    assert.match(d.querySelector('[role=alert]').textContent,/Изберете Excel/)
    await upload(Buffer.alloc(10*1024*1024+1),'large.csv')
    assert.match(d.querySelector('[role=alert]').textContent,/10 MB/)
    await csv('Наименование\n'+Array.from({length:5001},(_,i)=>'Фирма '+i).join('\n'))
    assert.match(d.querySelector('[role=alert]').textContent,/5000/)
    pass('extension, 10 MB and 5000-row limits')
    const downloads=[]
    w.XLSX.writeFile=(workbook,name)=>downloads.push({workbook,name})
    button('Свали шаблон').click()
    await waitFor(()=>downloads.length===1)
    assert.equal(w.XLSX.utils.sheet_to_json(downloads[0].workbook.Sheets['Работодатели'],{header:1}).length,1)
    button('Затвори').click()
    await waitFor(()=>!button('Затвори'))
    button('Експорт Excel').click()
    await waitFor(()=>downloads.length===2)
    const bytes=XLSX.write(downloads[1].workbook,{type:'buffer',bookType:'xlsx'})
    const book=XLSX.read(bytes,{type:'buffer'})
    const rows=XLSX.utils.sheet_to_json(book.Sheets['Работодатели'],{header:1,raw:false})
    assert.equal(rows.length,121)
    assert.equal(rows[1][2],'001230')
    assert.equal(rows[1][6],'0888123456')
    pass('template and 120-row export produce valid Excel workbooks')
    w.mount(false)
    await waitFor(()=>!button('Импорт'))
    assert.ok(button('Експорт Excel'))
    assert.equal(button('Експорт Excel').disabled,false)
    pass('non-admin export available and import hidden')
    assert.equal(w.getWrites(),0)
    assert.deepEqual(errors,[])
    pass('zero DB writes and zero DOM errors')
    console.log(checks+' DOM checks passed')
  } finally {w.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
