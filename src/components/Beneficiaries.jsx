import { useEffect, useMemo, useState } from 'react';
import { database } from '../firebase';
import { get, push, ref, remove, update } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';

const emptyForm = { photo: '', firstName: '', middleName: '', lastName: '', gender: '', birthDate: '', identifier: '', status: '', active: true, archived: false };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '5px' };
const MAX_PHOTO_BYTES = 300 * 1024;
const MAX_PHOTO_DIMENSION = 500;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Браузърът не поддържа обработка на изображения.');
        ctx.drawImage(image, 0, 0, width, height);

        let quality = 0.75;
        const makeDataUrl = () => canvas.toDataURL('image/jpeg', quality);
        let dataUrl = makeDataUrl();

        while (dataUrl.length * 0.75 > MAX_PHOTO_BYTES && quality > 0.35) {
          quality -= 0.05;
          dataUrl = makeDataUrl();
        }

        if (dataUrl.length * 0.75 > MAX_PHOTO_BYTES) {
          throw new Error('Снимката остава прекалено голяма след компресиране.');
        }

        resolve(dataUrl);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Изображението не може да бъде обработено. Избери JPG или PNG снимка.'));
    };

    image.src = objectUrl;
  });
}

export default function Beneficiaries() {
  const { currentUser } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const loadBeneficiaries = async () => {
    if (!currentUser) return;
    try {
      setLoading(true); setError('');
      const snapshot = await get(ref(database, 'beneficiaries'));
      if (!snapshot.exists()) { setBeneficiaries([]); return; }
      setBeneficiaries(Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value })));
    } catch (err) { console.error(err); setError(`Бенефициентите не могат да бъдат заредени: ${err.code || err.message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBeneficiaries(); }, [currentUser]);

  const filteredBeneficiaries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('bg-BG');
    if (!term) return beneficiaries;
    return beneficiaries.filter(b => [b.firstName, b.middleName, b.lastName, b.identifier].some(value => String(value || '').toLocaleLowerCase('bg-BG').includes(term)));
  }, [beneficiaries, search]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePhoto = async e => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith('image/')) { setError('Моля, избери изображение.'); return; }
    try {
      setUploading(true); setError('');
      const compressedPhoto = await compressImage(file);
      setForm(prev => ({ ...prev, photo: compressedPhoto }));
    } catch (err) {
      console.error(err);
      setError(`Снимката не може да бъде обработена: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = b => { setEditingId(b.id); setForm({ ...emptyForm, ...b }); setError(''); setShowForm(true); };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!currentUser) return;
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('Името и фамилията са задължителни.'); return; }
    try {
      setSaving(true); setError('');
      let beneficiaryId = editingId;
      if (!beneficiaryId) beneficiaryId = push(ref(database, 'beneficiaries')).key;
      const data = {
        id: beneficiaryId,
        photo: form.photo || '', firstName: form.firstName.trim(), middleName: form.middleName.trim(), lastName: form.lastName.trim(),
        gender: form.gender, birthDate: form.birthDate, identifier: form.identifier.trim(), status: form.status.trim(),
        active: !!form.active, archived: !!form.archived, updatedBy: currentUser.uid, updatedAt: new Date().toISOString()
      };
      if (editingId) await update(ref(database, `beneficiaries/${editingId}`), data);
      else await update(ref(database, `beneficiaries/${beneficiaryId}`), { ...data, createdBy: currentUser.uid, createdAt: new Date().toISOString() });
      setForm(emptyForm); setEditingId(null); setShowForm(false); await loadBeneficiaries();
    } catch (err) { console.error(err); setError(`Бенефициентът не може да бъде записан: ${err.code || err.message}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!currentUser || !window.confirm('Сигурен ли си, че искаш да изтриеш този бенефициент?')) return;
    try { await remove(ref(database, `beneficiaries/${id}`)); await loadBeneficiaries(); }
    catch (err) { console.error(err); setError(`Бенефициентът не може да бъде изтрит: ${err.code || err.message}`); }
  };

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Бенефициенти</h2><p style={{ color: '#777', margin: '6px 0 0' }}>Регистър на бенефициентите</p></div>
      <button onClick={openAdd} style={{ padding: '10px 18px', background: '#198754', color: 'white', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Добави</button>
    </div>
    <div style={{ background: 'white', padding: '15px 20px', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 20 }}>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔎 Търсене по име, фамилия или ЕГН / ЛНЧ..." style={{ ...inputStyle, marginTop: 0, maxWidth: 600 }} />
    </div>
    {error && <div style={{ background: '#fff3cd', color: '#856404', padding: '12px 16px', borderRadius: 6, marginBottom: 20 }}>{error}</div>}
    {showForm && <form onSubmit={handleSubmit} style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>{editingId ? 'Редактиране на бенефициент' : 'Нов бенефициент'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <label>Снимка<input style={inputStyle} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} disabled={uploading} />{uploading && <div style={{ marginTop: 6, color: '#666' }}>Обработване и компресиране...</div>}{form.photo && <img src={form.photo} alt="Преглед" style={{ display: 'block', marginTop: 8, width: 70, height: 70, objectFit: 'cover', borderRadius: 6 }} />}</label>
        <label>Име<input style={inputStyle} name="firstName" value={form.firstName} onChange={handleChange} required /></label>
        <label>Презиме<input style={inputStyle} name="middleName" value={form.middleName} onChange={handleChange} /></label>
        <label>Фамилия<input style={inputStyle} name="lastName" value={form.lastName} onChange={handleChange} required /></label>
        <label>Пол<select style={inputStyle} name="gender" value={form.gender} onChange={handleChange}><option value="">Избери</option><option value="Мъж">Мъж</option><option value="Жена">Жена</option></select></label>
        <label>Рождена дата<input style={inputStyle} type="date" name="birthDate" value={form.birthDate} onChange={handleChange} /></label>
        <label>ЕГН / ЛНЧ<input style={inputStyle} name="identifier" value={form.identifier} onChange={handleChange} /></label>
        <label>Статут<input style={inputStyle} name="status" value={form.status} onChange={handleChange} /></label>
      </div>
      <div style={{ display: 'flex', gap: 25, marginTop: 18 }}>
        <label><input type="checkbox" name="active" checked={!!form.active} onChange={handleChange} /> Активен</label>
        <label><input type="checkbox" name="archived" checked={!!form.archived} onChange={handleChange} /> Архивиран</label>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button type="submit" disabled={saving || uploading} style={{ padding: '9px 18px', background: '#0d6efd', color: 'white', border: 0, borderRadius: 5, cursor: 'pointer' }}>{saving ? 'Записване...' : 'Запази'}</button>
        <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={{ padding: '9px 18px', background: '#6c757d', color: 'white', border: 0, borderRadius: 5, cursor: 'pointer' }}>Отказ</button>
      </div>
    </form>}
    <div style={{ background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
      {loading ? <p>Зареждане...</p> : <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1250 }}>
        <thead><tr style={{ borderBottom: '2px solid #ddd' }}>{['Id','Снимка','Име','Презиме','Фамилия','Пол','Рождена дата','ЕГН / ЛНЧ','Статут','Активен','Архивиран','Действия'].map(c => <th key={c} style={{ padding: 10, textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>)}</tr></thead>
        <tbody>{filteredBeneficiaries.map(b => <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
          <td style={{ padding: 10, fontSize: 12 }}>{b.id}</td><td style={{ padding: 10 }}>{b.photo ? <img src={b.photo} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} /> : '—'}</td>
          <td style={{ padding: 10 }}>{b.firstName || '—'}</td><td style={{ padding: 10 }}>{b.middleName || '—'}</td><td style={{ padding: 10 }}>{b.lastName || '—'}</td><td style={{ padding: 10 }}>{b.gender || '—'}</td><td style={{ padding: 10 }}>{b.birthDate || '—'}</td><td style={{ padding: 10 }}>{b.identifier || '—'}</td><td style={{ padding: 10 }}>{b.status || '—'}</td>
          <td style={{ padding: 10, textAlign: 'center' }}><input type="checkbox" checked={!!b.active} readOnly /></td><td style={{ padding: 10, textAlign: 'center' }}><input type="checkbox" checked={!!b.archived} readOnly /></td>
          <td style={{ padding: 10, whiteSpace: 'nowrap' }}><button onClick={() => openEdit(b)} style={{ marginRight: 6, padding: '6px 10px', background: '#0d6efd', color: 'white', border: 0, borderRadius: 4, cursor: 'pointer' }}>Редактирай</button><button onClick={() => handleDelete(b.id)} style={{ padding: '6px 10px', background: '#dc3545', color: 'white', border: 0, borderRadius: 4, cursor: 'pointer' }}>Изтрий</button></td>
        </tr>)}{filteredBeneficiaries.length === 0 && <tr><td colSpan="12" style={{ padding: 25, textAlign: 'center', color: '#777' }}>{search ? 'Няма намерени бенефициенти.' : 'Няма добавени бенефициенти.'}</td></tr>}</tbody>
      </table>}
    </div>
  </div>;
}
