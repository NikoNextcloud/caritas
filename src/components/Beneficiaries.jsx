import React, { useEffect, useMemo, useState } from 'react';
import { get, push, ref, remove, update } from 'firebase/database';
import { database } from '../firebase';

const MAX_PHOTO_BYTES = 300 * 1024;
const MAX_PHOTO_DIMENSION = 500;
const emptyForm = { firstName:'', middleName:'', lastName:'', gender:'', birthDate:'', identifier:'', status:'active', photo:'' };

function compressImage(file) {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{try{
      const scale=Math.min(1,MAX_PHOTO_DIMENSION/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
      let q=.75, data=canvas.toDataURL('image/jpeg',q);
      while(data.length*.75>MAX_PHOTO_BYTES&&q>.35){q-=.05;data=canvas.toDataURL('image/jpeg',q)}
      if(data.length*.75>MAX_PHOTO_BYTES) throw new Error('Снимката остава прекалено голяма.');
      resolve(data);
    }catch(e){reject(e)}finally{URL.revokeObjectURL(url)}};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Снимката не може да бъде обработена.'))};
    img.src=url;
  });
}
function nextId(items){const ids=Object.values(items).map(x=>Number(x.id)).filter(x=>Number.isInteger(x)&&x>0);return ids.length?Math.max(...ids)+1:1}

export default function Beneficiaries({ user }) {
 const [items,setItems]=useState({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [search,setSearch]=useState(''),[view,setView]=useState('list'),[editing,setEditing]=useState(null),[selected,setSelected]=useState(null);
 const [form,setForm]=useState(emptyForm);

 const load=async()=>{try{setLoading(true);const s=await get(ref(database,'beneficiaries'));setItems(s.exists()?s.val():{})}catch(e){alert('Грешка при зареждане: '+e.message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 const list=useMemo(()=>Object.entries(items).map(([firebaseKey,x])=>({...x,firebaseKey})).sort((a,b)=>Number(a.id||0)-Number(b.id||0)),[items]);
 const filtered=list.filter(x=>[x.id,x.firstName,x.middleName,x.lastName,x.identifier].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()));

 const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
 const reset=()=>{setForm(emptyForm);setEditing(null)};
 const add=()=>{reset();setView('add')};
 const edit=x=>{setEditing(x.firebaseKey);setForm({firstName:x.firstName||'',middleName:x.middleName||'',lastName:x.lastName||'',gender:x.gender||'',birthDate:x.birthDate||'',identifier:x.identifier||'',status:x.status||'active',photo:x.photo||''});setView('add');window.scrollTo({top:0,behavior:'smooth'})};
 const photo=async e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/'))return alert('Моля, избери изображение.');try{setSaving(true);const compressed=await compressImage(f);setForm(x=>({...x,photo:compressed}))}catch(err){alert('Грешка при снимката: '+err.message)}finally{setSaving(false)}};
 const save=async e=>{e.preventDefault();if(!form.firstName.trim()||!form.lastName.trim())return alert('Собствено име и фамилия са задължителни.');try{setSaving(true);const id=editing?items[editing]?.id:nextId(items);const data={id:Number(id),firstName:form.firstName.trim(),middleName:form.middleName.trim(),lastName:form.lastName.trim(),gender:form.gender,birthDate:form.birthDate,identifier:form.identifier.trim(),status:form.status,active:form.status==='active',archived:form.status==='archived',photo:form.photo||'',updatedBy:user?.uid||'unknown',updatedAt:Date.now()};
 if(editing){await update(ref(database,'beneficiaries/'+editing),data);setItems(p=>({...p,[editing]:{...p[editing],...data}}))}
 else {const r=push(ref(database,'beneficiaries'));const x={...data,createdBy:user?.uid||'unknown',createdAt:Date.now()};await update(r,x);setItems(p=>({...p,[r.key]:x}))}
 reset();setView('list');
 }catch(err){alert('Грешка при записване: '+err.message)}finally{setSaving(false)}};
 const del=async x=>{if(!confirm('Сигурен ли си, че искаш да изтриеш бенефициент №'+x.id+'?'))return;try{setSaving(true);await remove(ref(database,'beneficiaries/'+x.firebaseKey));setItems(p=>{const n={...p};delete n[x.firebaseKey];return n});if(editing===x.firebaseKey)reset()}catch(e){alert('Грешка при изтриване: '+e.message)}finally{setSaving(false)}};

 return <section className="page-card beneficiaries-page">
  <div className="page-heading"><div><h1>Бенефициенти</h1><div className="breadcrumb">Начало / Бенефициенти</div></div><button className="btn btn-primary" onClick={add}>+ Добави</button></div>
  <div className="module-tabs"><button className={view==='list'?'active':''} onClick={()=>{reset();setView('list')}}>Листване</button><button className={view==='add'?'active':''} onClick={add}>{editing?'Редактиране':'Добави'}</button></div>
  {view==='add'?<div className="beneficiary-form module-form">
    <h2>{editing?'Редактиране на бенефициент №'+items[editing]?.id:'Добави бенефициент'}</h2>
    <form onSubmit={save} className="form-grid">
      <label>Собствено име *<input name="firstName" value={form.firstName} onChange={change} required/></label>
      <label>Бащино име<input name="middleName" value={form.middleName} onChange={change}/></label>
      <label>Фамилия *<input name="lastName" value={form.lastName} onChange={change} required/></label>
      <label>Пол<select name="gender" value={form.gender} onChange={change}><option value="">Избери</option><option value="male">Мъж</option><option value="female">Жена</option></select></label>
      <label>Дата на раждане<input type="date" name="birthDate" value={form.birthDate} onChange={change}/></label>
      <label>Идентификатор<input name="identifier" value={form.identifier} onChange={change}/></label>
      <label>Статус<select name="status" value={form.status} onChange={change}><option value="active">Активен</option><option value="archived">Архивиран</option></select></label>
      <label>Снимка<input type="file" accept="image/*" onChange={photo}/></label>
      <div className="form-actions"><button className="btn btn-primary" disabled={saving}>{saving?'Записване...':editing?'Запази промените':'Запази'}</button><button type="button" className="btn btn-light" onClick={()=>{reset();setView('list')}}>Отказ</button></div>
    </form>
    {form.photo&&<img className="beneficiary-preview" src={form.photo} onClick={()=>setSelected(form.photo)} alt="Преглед"/>}
  </div>:
  <>
   <div className="table-toolbar"><h2>Листване</h2><input className="search-input" placeholder="Търсене..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <div className="table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>Снимка</th><th>Име</th><th>Пол</th><th>Дата на раждане</th><th>Идентификатор</th><th>Статус</th><th>Действия</th></tr></thead><tbody>
   {loading?<tr><td colSpan="8" className="empty-row">Зареждане...</td></tr>:filtered.length?filtered.map(x=><tr key={x.firebaseKey}><td><strong>{x.id}</strong></td><td>{x.photo?<img className="beneficiary-thumb" src={x.photo} onClick={()=>setSelected(x.photo)} alt=""/>:'—'}</td><td>{[x.firstName,x.middleName,x.lastName].filter(Boolean).join(' ')}</td><td>{x.gender==='male'?'Мъж':x.gender==='female'?'Жена':'—'}</td><td>{x.birthDate||'—'}</td><td>{x.identifier||'—'}</td><td><span className="status-badge">{x.status==='archived'?'Архивиран':'Активен'}</span></td><td><button className="table-action edit-action" onClick={()=>edit(x)}>Редактирай</button> <button className="table-action danger" onClick={()=>del(x)} disabled={saving}>Изтрий</button></td></tr>):<tr><td colSpan="8" className="empty-row">Няма намерени бенефициенти.</td></tr>}
   </tbody></table></div><div className="pagination"><span>Брой записи: {filtered.length}</span><div><button className="selected">20</button><button>30</button><button>50</button></div></div>
  </>}
  {selected&&<div className="photo-modal" onClick={()=>setSelected(null)}><button onClick={()=>setSelected(null)}>×</button><img src={selected} onClick={e=>e.stopPropagation()} alt="Бенефициент"/></div>}
 </section>;
}
