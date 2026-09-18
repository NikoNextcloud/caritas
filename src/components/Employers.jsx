import { useEffect, useMemo, useState } from 'react';
import { get, push, ref, remove, update } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const empty = {
  name: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  status: 'active',
};

export default function Employers() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState({});
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('list');

  async function load() {
    setLoading(true);
    try {
      const snapshot = await get(ref(database, 'employers'));
      setItems(snapshot.exists() ? snapshot.val() : {});
    } catch (error) {
      alert('Грешка при зареждане: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const reset = () => {
    setForm(empty);
    setEditing(null);
  };

  const add = () => {
    reset();
    setView('add');
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return alert('Въведи име на работодателя.');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return alert('Въведи валиден E-mail или остави полето празно.');
    }

    try {
      setSaving(true);
      const now = Date.now();
      const data = {
        name: form.name.trim(),
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        status: form.status === 'archived' ? 'archived' : 'active',
        active: form.status !== 'archived',
        updatedBy: currentUser?.uid || 'unknown',
        updatedAt: now,
      };

      if (editing) {
        await update(ref(database, 'employers/' + editing), data);
        setItems((current) => ({
          ...current,
          [editing]: { ...current[editing], ...data },
        }));
      } else {
        const record = push(ref(database, 'employers'));
        const created = { ...data, createdBy: currentUser?.uid || 'unknown', createdAt: now };
        await update(record, created);
        setItems((current) => ({ ...current, [record.key]: created }));
      }

      reset();
      setView('list');
    } catch (error) {
      alert('Грешка при записване: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (id, employer) => {
    setEditing(id);
    setForm({
      name: employer.name || '',
      contact: employer.contact || '',
      phone: employer.phone || '',
      email: employer.email || '',
      address: employer.address || '',
      notes: employer.notes || '',
      status: employer.status === 'archived' ? 'archived' : 'active',
    });
    setView('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const del = async (id) => {
    if (!confirm('Изтрий работодателя?')) return;
    try {
      setSaving(true);
      await remove(ref(database, 'employers/' + id));
      setItems((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      if (editing === id) reset();
    } catch (error) {
      alert('Грешка при изтриване: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return Object.entries(items)
      .map(([id, employer]) => ({ id, ...employer }))
      .filter((employer) => {
        if (!term) return true;
        return [
          employer.name,
          employer.contact,
          employer.phone,
          employer.email,
          employer.address,
          employer.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      });
  }, [items, search]);

  return (
    <section className="page-card employers-page">
      <div className="page-heading">
        <div>
          <h1>Работодатели</h1>
          <div className="breadcrumb">Начало / Работодатели / Листване</div>
        </div>
        <button className="btn btn-primary" onClick={add}>+ Добави</button>
      </div>

      <div className="module-tabs">
        <button className={view === 'list' ? 'active' : ''} onClick={() => { reset(); setView('list'); }}>Листване</button>
        <button className={view === 'add' ? 'active' : ''} onClick={add}>{editing ? 'Редактиране' : 'Добави'}</button>
      </div>

      {view === 'add' && <div className="module-form">
        <h2>{editing ? 'Редактиране на работодател' : 'Нов работодател'}</h2>
        <form onSubmit={save} className="form-grid">
          <label>
            Име на работодателя *
            <input name="name" value={form.name} onChange={change} required />
          </label>

          <label>
            Лице за контакт
            <input name="contact" value={form.contact} onChange={change} />
          </label>

          <label>
            Телефон
            <input name="phone" value={form.phone} onChange={change} />
          </label>

          <label>
            E-mail
            <input type="email" name="email" value={form.email} onChange={change} />
          </label>

          <label>
            Адрес
            <input name="address" value={form.address} onChange={change} />
          </label>

          <label>
            Статус
            <select name="status" value={form.status} onChange={change}>
              <option value="active">Активен</option>
              <option value="archived">Архивиран</option>
            </select>
          </label>

          <label className="full-width-field">
            Бележки
            <textarea name="notes" value={form.notes} onChange={change} rows="4" />
          </label>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Записване...' : editing ? 'Запази промените' : 'Запази'}
            </button>
            {editing && (
              <button type="button" className="btn btn-light" onClick={() => { reset(); setView('list'); }}>Отказ</button>
            )}
          </div>
        </form>
      </div>}

      {view === 'list' && <>
      <div className="table-toolbar">
        <h2>Листване</h2>
        <input
          className="search-input"
          placeholder="Търси работодател..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Име</th>
              <th>Лице за контакт</th>
              <th>Телефон</th>
              <th>E-mail</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="empty-row">Зареждане...</td></tr>
            ) : list.length ? (
              list.map((employer) => (
                <tr key={employer.id}>
                  <td><strong>{employer.name}</strong></td>
                  <td>{employer.contact || '—'}</td>
                  <td>{employer.phone || '—'}</td>
                  <td>{employer.email || '—'}</td>
                  <td>
                    <span className={`status-badge ${employer.status === 'archived' ? 'status-inactive' : 'status-active'}`}>
                      {employer.status === 'archived' ? 'Неактивен' : 'Активен'}
                    </span>
                  </td>
                  <td>
                    <button className="table-action edit-action" onClick={() => edit(employer.id, employer)}>
                      Редактирай
                    </button>{' '}
                    <button className="table-action danger" onClick={() => del(employer.id)} disabled={saving}>
                      Изтрий
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6" className="empty-row">Няма работодатели.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>Брой записи: {list.length}</span>
      </div>
      </>}
    </section>
  );
}
