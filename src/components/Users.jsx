import { useEffect, useState } from 'react';
import { get, push, ref, remove, update } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const empty = {
  uid: '',
  name: '',
  email: '',
  phone: '',
  role: 'user',
  active: true,
};

export default function Users() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState({});
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');

  async function load() {
    setLoading(true);
    try {
      const snapshot = await get(ref(database, 'users'));
      setItems(snapshot.exists() ? snapshot.val() : {});
    } catch (error) {
      alert('Грешка при зареждане на потребителите: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin]);

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm(empty);
    setEditing(null);
  };

  const add = () => {
    resetForm();
    setView('add');
  };

  const save = async (event) => {
    event.preventDefault();

    if (!isAdmin) return;
    if (!form.name.trim()) return alert('Въведи име на потребителя.');
    if (!form.email.trim()) return alert('Въведи E-mail.');
    if (!editing && !form.uid.trim()) {
      return alert('Въведи Firebase UID на потребителя.');
    }

    try {
      const uid = (editing || form.uid).trim();
      const data = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role === 'admin' ? 'admin' : 'user',
        active: Boolean(form.active),
        updatedAt: Date.now(),
      };

      if (editing) {
        await update(ref(database, 'users/' + editing), data);
        setItems((current) => ({
          ...current,
          [editing]: { ...current[editing], ...data },
        }));
      } else {
        const existing = items[uid];
        if (existing) return alert('Вече има профил с този UID.');
        await update(ref(database, 'users/' + uid), {
          ...data,
          createdAt: Date.now(),
        });
        setItems((current) => ({
          ...current,
          [uid]: { ...data, createdAt: Date.now() },
        }));
      }

      resetForm();
      setView('list');
    } catch (error) {
      alert('Грешка при записване: ' + error.message);
    }
  };

  const edit = (uid, user) => {
    setEditing(uid);
    setForm({
      uid,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role === 'admin' ? 'admin' : 'user',
      active: user.active !== false,
    });
    setView('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const del = async (uid) => {
    if (!isAdmin) return;
    if (!confirm('Изтрий профила на този потребител?')) return;

    try {
      await remove(ref(database, 'users/' + uid));
      setItems((current) => {
        const next = { ...current };
        delete next[uid];
        return next;
      });
      if (editing === uid) resetForm();
    } catch (error) {
      alert('Грешка при изтриване: ' + error.message);
    }
  };

  const list = Object.entries(items)
    .map(([uid, user]) => ({ uid, ...user }))
    .filter((user) => {
      const text = [user.name, user.email, user.phone, user.role, user.uid]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(search.toLowerCase());
    });

  if (!isAdmin) {
    return (
      <section className="page-card">
        <div className="page-heading">
          <div>
            <h1>Потребители</h1>
            <div className="breadcrumb">Начало / Потребители</div>
          </div>
        </div>
        <div className="alert">Нямаш права за управление на потребители.</div>
      </section>
    );
  }

  return (
    <section className="page-card">
      <div className="page-heading">
        <div>
          <h1>Потребители</h1>
          <div className="breadcrumb">Начало / Потребители / Листване</div>
        </div>
        <button className="btn btn-primary" onClick={add}>+ Добави</button>
      </div>

      <div className="module-tabs">
        <button className={view === 'list' ? 'active' : ''} onClick={() => { resetForm(); setView('list'); }}>Листване</button>
        <button className={view === 'add' ? 'active' : ''} onClick={add}>{editing ? 'Редактиране' : 'Добави'}</button>
      </div>

      {view === 'add' && <div className="module-form">
        <h2>{editing ? 'Редактиране на потребител' : 'Нов потребителски профил'}</h2>
        <p className="form-help">
          Тук управляваме профила, ролята и достъпа. Самото създаване на Firebase Login акаунт се прави отделно от Firebase Authentication.
        </p>

        <form onSubmit={save} className="form-grid">
          {!editing && (
            <label>
              Firebase UID *
              <input
                name="uid"
                value={form.uid}
                onChange={change}
                placeholder="напр. abc123..."
                required
              />
            </label>
          )}

          <label>
            Име *
            <input name="name" value={form.name} onChange={change} required />
          </label>

          <label>
            E-mail *
            <input type="email" name="email" value={form.email} onChange={change} required />
          </label>

          <label>
            Телефон
            <input name="phone" value={form.phone} onChange={change} />
          </label>

          <label>
            Роля
            <select name="role" value={form.role} onChange={change}>
              <option value="user">Потребител</option>
              <option value="admin">Администратор</option>
            </select>
          </label>

          <label className="checkbox-field">
            <input type="checkbox" name="active" checked={form.active} onChange={change} />
            <span>Активен потребител</span>
          </label>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Запази</button>
            {editing && (
              <button type="button" className="btn btn-light" onClick={() => { resetForm(); setView('list'); }}>Отказ</button>
            )}
          </div>
        </form>
      </div>}

      {view === 'list' && <>
      <div className="table-toolbar">
        <h2>Листване</h2>
        <input
          className="search-input"
          placeholder="Търси потребител..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Име</th>
              <th>E-mail</th>
              <th>Телефон</th>
              <th>Роля</th>
              <th>Статус</th>
              <th>UID</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="empty-row">Зареждане...</td></tr>
            ) : list.length ? (
              list.map((user) => (
                <tr key={user.uid}>
                  <td><strong>{user.name || '—'}</strong></td>
                  <td>{user.email || '—'}</td>
                  <td>{user.phone || '—'}</td>
                  <td>
                    <span className="status-badge">
                      {user.role === 'admin' ? 'Администратор' : 'Потребител'}
                    </span>
                  </td>
                  <td><span className={`status-badge ${user.active === false ? 'status-inactive' : 'status-active'}`}>{user.active === false ? 'Неактивен' : 'Активен'}</span></td>
                  <td className="uid-cell">{user.uid}</td>
                  <td>
                    <button className="table-action edit-action" onClick={() => edit(user.uid, user)}>
                      Редактирай
                    </button>{' '}
                    <button className="table-action danger" onClick={() => del(user.uid)}>
                      Изтрий
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="7" className="empty-row">Няма потребители.</td></tr>
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
