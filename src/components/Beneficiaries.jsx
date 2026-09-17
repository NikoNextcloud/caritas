import { useEffect, useState } from 'react';
import { database } from '../firebase';
import { get, push, ref } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';

const emptyForm = {
  photo: '',
  firstName: '',
  middleName: '',
  lastName: '',
  gender: '',
  birthDate: '',
  identifier: '',
  status: '',
  active: true,
  archived: false,
};

export default function Beneficiaries() {
  const { currentUser, isAdmin } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadBeneficiaries = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setError('');
      const snapshot = await get(ref(database, 'beneficiaries'));
      if (!snapshot.exists()) {
        setBeneficiaries([]);
        return;
      }
      const data = snapshot.val();
      setBeneficiaries(
        Object.entries(data).map(([id, value]) => ({ id, ...value }))
      );
    } catch (err) {
      console.error('Error loading beneficiaries:', err);
      setError('Бенефициентите не могат да бъдат заредени.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBeneficiaries();
  }, [currentUser]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Името и фамилията са задължителни.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await push(ref(database, 'beneficiaries'), {
        ...form,
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        identifier: form.identifier.trim(),
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
      });
      setForm(emptyForm);
      setShowForm(false);
      await loadBeneficiaries();
    } catch (err) {
      console.error('Error creating beneficiary:', err);
      setError('Бенефициентът не може да бъде добавен.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Бенефициенти</h2>
          <p style={{ color: '#777', margin: '6px 0 0' }}>Регистър на бенефициентите</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setError(''); setShowForm(true); }}
            style={{ padding: '10px 18px', background: '#198754', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            + Добави
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fff3cd', color: '#856404', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0 }}>Нов бенефициент</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <label>Снимка<input name="photo" value={form.photo} onChange={handleChange} placeholder="URL на снимка" /></label>
            <label>Име<input name="firstName" value={form.firstName} onChange={handleChange} required /></label>
            <label>Презиме<input name="middleName" value={form.middleName} onChange={handleChange} /></label>
            <label>Фамилия<input name="lastName" value={form.lastName} onChange={handleChange} required /></label>
            <label>Пол<select name="gender" value={form.gender} onChange={handleChange}><option value="">Избери</option><option value="Мъж">Мъж</option><option value="Жена">Жена</option></select></label>
            <label>Рождена дата<input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} /></label>
            <label>ЕГН / ЛНЧ<input name="identifier" value={form.identifier} onChange={handleChange} /></label>
            <label>Статут<input name="status" value={form.status} onChange={handleChange} placeholder="Статут" /></label>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
            <label><input type="checkbox" name="active" checked={form.active} onChange={handleChange} /> Активен</label>
            <label><input type="checkbox" name="archived" checked={form.archived} onChange={handleChange} /> Архивиран</label>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" disabled={saving} style={{ padding: '9px 18px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>{saving ? 'Записване...' : 'Запази'}</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '9px 18px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Отказ</button>
          </div>
        </form>
      )}

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        {loading ? <p>Зареждане...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                {['Id', 'Снимка', 'Име', 'Презиме', 'Фамилия', 'Пол', 'Рождена дата', 'ЕГН / ЛНЧ', 'Статут', 'Активен', 'Архивиран'].map(column => <th key={column} style={{ padding: '10px', textAlign: 'left', whiteSpace: 'nowrap' }}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontSize: '12px' }}>{b.id}</td>
                  <td style={{ padding: '10px' }}>{b.photo ? <img src={b.photo} alt="" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} /> : '—'}</td>
                  <td style={{ padding: '10px' }}>{b.firstName || '—'}</td>
                  <td style={{ padding: '10px' }}>{b.middleName || '—'}</td>
                  <td style={{ padding: '10px' }}>{b.lastName || '—'}</td>
                  <td style={{ padding: '10px' }}>{b.gender || '—'}</td>
                  <td style={{ padding: '10px' }}>{b.birthDate || '—'}</td>
                  <td style={{ padding: '10px' }}>{b.identifier || '—'}</td>
                  <td style={{ padding: '10px' }}>{b.status || '—'}</td>
                  <td style={{ padding: '10px' }}>{b.active ? 'Да' : 'Не'}</td>
                  <td style={{ padding: '10px' }}>{b.archived ? 'Да' : 'Не'}</td>
                </tr>
              ))}
              {beneficiaries.length === 0 && <tr><td colSpan="11" style={{ padding: '25px', textAlign: 'center', color: '#777' }}>Няма добавени бенефициенти.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
