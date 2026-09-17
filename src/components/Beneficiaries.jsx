import { useEffect, useMemo, useState } from 'react';
import { database } from '../firebase';
import { get, push, ref, remove, update } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';

const emptyForm = {
  photo: '', firstName: '', middleName: '', lastName: '', gender: '',
  birthDate: '', identifier: '', status: '', active: true, archived: false,
};

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '5px' };

export default function Beneficiaries() {
  const { currentUser } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadBeneficiaries = async () => {
    if (!currentUser) return;
    try {
      setLoading(true); setError('');
      const snapshot = await get(ref(database, 'beneficiaries'));
      if (!snapshot.exists()) { setBeneficiaries([]); return; }
      setBeneficiaries(Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value })));
    } catch (err) {
      console.error(err); setError('Бенефициентите не могат да бъдат заредени.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadBeneficiaries(); }, [currentUser]);

  const filteredBeneficiaries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('bg-BG');
    if (!term) return beneficiaries;
    return beneficiaries.filter(b => [b.firstName, b.middleName, b.lastName, b.identifier]
      .some(value => String(value || '').toLocaleLowerCase('bg-BG').includes(term)));
  }, [beneficiaries, search]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit = (beneficiary) => {
    setEditingId(beneficiary.id);
    setForm({ ...emptyForm, ...beneficiary });
    setError(''); setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser) return;
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('Името и фамилията са задължителни.'); return; }
    try {
      setSaving(true); setError('');
      const data = {
        photo: form.photo.trim(), firstName: form.firstName.trim(), middleName: form.middleName.trim(),
        lastName: form.lastName.trim(), gender: form.gender, birthDate: form.birthDate,
        identifier: form.identifier.trim(), status: form.status.trim(), active: !!form.active, archived: !!form.archived,
        updatedBy: currentUser.uid, updatedAt: new Date().toISOString(),
      };
      if (editingId) await update(ref(database, `beneficiaries/${editingId}`), data);
      else await push(ref(database, 'beneficiaries'), { ...data, createdBy: currentUser.uid, createdAt: new Date().toISOString() });
      setForm(emptyForm); setEditingId(null); setShowForm(false); await loadBeneficiaries();
    } catch (err) {
      console.error(err); setError('Бенефициентът не може да бъде записан.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!currentUser) return;
    if (!window.confirm('Сигурен ли си, че искаш да изтриеш този бенефициент?')) return;
    try { await remove(ref(database, `beneficiaries/${id}`)); await loadBeneficiaries(); }
    catch (err) { console.error(err); setError('Бенефициентът не може да бъде изтрит.'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: 0 }}>Бенефициенти</h2><p style={{ color: '#777', margin: '6px 0 0' }}>Регистър на бенефициентите</p></div>
        <button onClick={openAdd} style={{ padding: '10px 18px', background: '#198754', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>+ Добави</button>
      </div>

      <div style={{ background: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔎 Търсене по име, фамилия или ЕГН / ЛНЧ..." style={{ ...inputStyle, marginTop: 0, maxWidth: '600px' }} />
      </div>

      {error && <div style={{ background: '#fff3cd', color: '#856404', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' }}>{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Редактиране на бенефициент' : 'Нов бенефициент'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <label>Снимка<input style={inputStyle} name="photo" value={form.photo} onChange={handleChange} placeholder="URL на снимка" /></label>
            <label>Име<input style={inputStyle} name="firstName" value={form.firstName} onChange={handleChange} required /></label>
            <label>Презиме<input style={inputStyle} name="middleName" value={form.middleName} onChange={handleChange} /></label>
            <label>Фамилия<input style={inputStyle} name="lastName" value={form.lastName} onChange={handleChange} required /></label>
            <label>Пол<select style={inputStyle} name="gender" value={form.gender} onChange={handleChange}><option value="">Избери</option><option value="Мъж">Мъж</option><option value="Жена">Жена</option></select></label>
            <label>Рождена дата<input style={inputStyle} type="date" name="birthDate" value={form.birthDate} onChange={handleChange} /></label>
            <label>ЕГН / ЛНЧ<input style={inputStyle} name="identifier" value={form.identifier} onChange={handleChange} /></label>
            <label>Статут<input style={inputStyle} name="status" value={form.status} onChange={handleChange} /></label>
          </div>
          <div style={{ display: 'flex', gap: '25px', marginTop: '18px' }}>
            <label style={{ cursor: 'pointer' }}><input type="checkbox" name="active" checked={!!form.active} onChange={handleChange} /> Активен</label>
            <label style={{ cursor: 'pointer' }}><input type="checkbox" name="archived" checked={!!form.archived} onChange={handleChange} /> Архивиран</label>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" disabled={saving} style={{ padding: '9px 18px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>{saving ? 'Записване...' : 'Запази'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={{ padding: '9px 18px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Отказ</button>
          </div>
        </form>
      )}

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        {loading ? <p>Зареждане...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1250px' }}>
            <thead><tr style={{ borderBottom: '2px solid #ddd' }}>
              {['Id','Снимка','Име','Презиме','Фамилия','Пол','Рождена дата','ЕГН / ЛНЧ','Статут','Активен','Архивиран','Действия'].map(c => <th key={c} style={{ padding: '10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>)}
            </tr></thead>
            <tbody>
              {filteredBeneficiaries.map(b => <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px', fontSize: '12px' }}>{b.id}</td>
                <td style={{ padding: '10px' }}>{b.photo ? <img src={b.photo} alt="" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} /> : '—'}</td>
                <td style={{ padding: '10px' }}>{b.firstName || '—'}</td><td style={{ padding: '10px' }}>{b.middleName || '—'}</td><td style={{ padding: '10px' }}>{b.lastName || '—'}</td>
                <td style={{ padding: '10px' }}>{b.gender || '—'}</td><td style={{ padding: '10px' }}>{b.birthDate || '—'}</td><td style={{ padding: '10px' }}>{b.identifier || '—'}</td><td style={{ padding: '10px' }}>{b.status || '—'}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}><input type="checkbox" checked={!!b.active} readOnly /></td>
                <td style={{ padding: '10px', textAlign: 'center' }}><input type="checkbox" checked={!!b.archived} readOnly /></td>
                <td style={{ padding: '10px', whiteSpace: 'nowrap' }}><button onClick={() => openEdit(b)} style={{ marginRight: '6px', padding: '6px 10px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Редактирай</button><button onClick={() => handleDelete(b.id)} style={{ padding: '6px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Изтрий</button></td>
              </tr>)}
              {filteredBeneficiaries.length === 0 && <tr><td colSpan="12" style={{ padding: '25px', textAlign: 'center', color: '#777' }}>{search ? 'Няма намерени бенефициенти.' : 'Няма добавени бенефициенти.'}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
