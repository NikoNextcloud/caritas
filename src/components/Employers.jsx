import { useEffect, useState } from 'react';
import { get, push, ref, remove, update } from 'firebase/database';
import { database } from '../firebase';

const empty = { name:'', contact:'', phone:'', email:'', notes:'' };

export default function Employers() {
  const [items,setItems]=useState({});
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState(null);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);

  async function load(){ setLoading(true); try{ const s=await get(ref(database,'employers')); setItems(s.exists()?s.val():{}); }catch(e){alert('Грешка при зареждане: '+e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  const change=e=>setForm({...form,[e.target.name]:e.target.value});
  const save=async e=>{e.preventDefault(); if(!form.name.trim()) return alert('Въведи име на работодателя.'); try{
    const data={...form,name:form.name.trim(),updatedAt:Date.now()};
    if(editing){await update(ref(database,'employers/'+editing),data);setItems(p=>({...p,[editing]:{...p[editing],...data}}))}
    else {const r=push(ref(database,'employers'));await update(r,{...data,createdAt:Date.now()});setItems(p=>({...p,[r.key]:{...data,createdAt:Date.now()}}))}
    setForm(empty);setEditing(null);
  }catch(e){alert('Грешка при записване: '+e.message)}};
  const edit=(id,x)=>{setEditing(id);setForm({...empty,...x});window.scrollTo({top:0,behavior:'smooth'})};
  const del=async id=>{if(!confirm('Изтрий работодателя?'))return;try{await remove(ref(database,'employers/'+id));setItems(p=>{const n={...p};delete n[id];return n})}catch(e){alert('Грешка при изтриване: '+e.message)}};
  const list=Object.entries(items).map(([id,x])=>({id,...x})).filter(x=>(x.name+' '+x.contact+' '+x.phone+' '+x.email).toLowerCase().includes(search.toLowerCase()));
  return <section className="page-card">
    <div className="page-heading"><div><h1>Работодатели</h1><div className="breadcrumb">Начало / Работодатели / Листване</div></div><button className="btn btn-primary" onClick={()=>{setEditing(null);setForm(empty)}}>+ Добави</button></div>
    <div className="module-form"><h2>{editing?'Редактиране на работодател':'Нов работодател'}</h2><form onSubmit={save} className="form-grid">
      {['name','contact','phone','email','notes'].map((name)=><label key={name}>{({name:'Име',contact:'Лице за контакт',phone:'Телефон',email:'E-mail',notes:'Бележки'})[name]}<input name={name} value={form[name]} onChange={change} /></label>)}
      <div className="form-actions"><button className="btn btn-primary" type="submit">Запази</button>{editing&&<button type="button" className="btn btn-light" onClick={()=>{setEditing(null);setForm(empty)}}>Отказ</button>}</div>
    </form></div>
    <div className="table-toolbar"><h2>Листване</h2><input className="search-input" placeholder="Търси работодател..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="table-wrap"><table className="admin-table"><thead><tr><th>Име</th><th>Лице за контакт</th><th>Телефон</th><th>E-mail</th><th>Действия</th></tr></thead><tbody>
      {loading?<tr><td colSpan="5" className="empty-row">Зареждане...</td></tr>:list.length?list.map(x=><tr key={x.id}><td><strong>{x.name}</strong></td><td>{x.contact||'—'}</td><td>{x.phone||'—'}</td><td>{x.email||'—'}</td><td><button className="table-action edit-action" onClick={()=>edit(x.id,x)}>Редактирай</button> <button className="table-action danger" onClick={()=>del(x.id)}>Изтрий</button></td></tr>):<tr><td colSpan="5" className="empty-row">Няма работодатели.</td></tr>}
    </tbody></table></div><div className="pagination"><span>Брой записи: {list.length}</span></div>
  </section>;
}
