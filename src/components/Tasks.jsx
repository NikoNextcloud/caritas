import { useEffect, useMemo, useState } from 'react';
import { get, push, ref, remove, update } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const empty = {
  title: '',
  description: '',
  beneficiaryId: '',
  employerId: '',
  assignedTo: '',
  status: 'new',
  dueDate: '',
};

const statusLabels = {
  new: 'Нова',
  'in-progress': 'В процес',
  done: 'Приключена',
  cancelled: 'Отказана',
};

export default function Tasks() {
  const { currentUser, isAdmin } = useAuth();
  const [items, setItems] = useState({});
  const [beneficiaries, setBeneficiaries] = useState({});
  const [employers, setEmployers] = useState({});
  const [users, setUsers] = useState({});
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [tasksSnap, beneficiariesSnap, employersSnap, usersSnap] = await Promise.all([
        get(ref(database, 'requests')),
        get(ref(database, 'beneficiaries')),
        get(ref(database, 'employers')),
        get(ref(database, 'users')),
      ]);

      setItems(tasksSnap.exists() ? tasksSnap.val() : {});
      setBeneficiaries(beneficiariesSnap.exists() ? beneficiariesSnap.val() : {});
      setEmployers(employersSnap.exists() ? employersSnap.val() : {});
      setUsers(usersSnap.exists() ? usersSnap.val() : {});
    } catch (error) {
      alert('Грешка при зареждане на задачите: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const beneficiaryList = useMemo(
    () => Object.entries(beneficiaries)
      .map(([key, item]) => ({
        key,
        ...item,
        displayName: [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' '),
      }))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0)),
    [beneficiaries]
  );

  const employerList = useMemo(
    () => Object.entries(employers)
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bg')),
    [employers]
  );

  const userList = useMemo(
    () => Object.entries(users)
      .map(([uid, item]) => ({ uid, ...item }))
      .filter((item) => item.active !== false)
      .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', 'bg')),
    [users]
  );

  const nameOfBeneficiary = (id) => {
    const item = beneficiaries[id];
    if (!item) return '—';
    return [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ') || ('№ ' + (item.id || id));
  };

  const nameOfEmployer = (id) => employers[id]?.name || '—';
  const nameOfUser = (uid) => users[uid]?.name || users[uid]?.email || '—';

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

  const edit = (task) => {
    setEditing(task.id);
    setForm({
      title: task.title || '',
      description: task.description || '',
      beneficiaryId: task.beneficiaryId || '',
      employerId: task.employerId || '',
      assignedTo: task.assignedTo || '',
      status: task.status || 'new',
      dueDate: task.dueDate || task.date || '',
    });
    setView('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return alert('Въведи задача.');

    try {
      setSaving(true);
      const now = Date.now();
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        beneficiaryId: form.beneficiaryId || '',
        employerId: form.employerId || '',
        assignedTo: form.assignedTo || '',
        status: ['new', 'in-progress', 'done', 'cancelled'].includes(form.status) ? form.status : 'new',
        dueDate: form.dueDate || '',
        beneficiaryName: form.beneficiaryId ? nameOfBeneficiary(form.beneficiaryId) : '',
        employerName: form.employerId ? nameOfEmployer(form.employerId) : '',
        assignedToName: form.assignedTo ? nameOfUser(form.assignedTo) : '',
        updatedBy: currentUser?.uid || '',
        updatedAt: now,
      };

      if (editing) {
        await update(ref(database, 'requests/' + editing), data);
        setItems((current) => ({
          ...current,
          [editing]: { ...current[editing], ...data },
        }));
      } else {
        const record = push(ref(database, 'requests'));
        const created = {
          ...data,
          createdBy: currentUser?.uid || '',
          createdAt: now,
        };
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

  const del = async (id) => {
    const task = items[id];
    if (!isAdmin && task?.createdBy !== currentUser?.uid) {
      return alert('Нямаш права да изтриеш тази задача.');
    }
    if (!confirm('Изтрий задачата?')) return;

    try {
      setSaving(true);
      await remove(ref(database, 'requests/' + id));
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
      .map(([id, item]) => ({ id, ...item }))
      .filter((task) => {
        if (!isAdmin) {
          const belongsToUser =
            task.createdBy === currentUser?.uid ||
            task.assignedTo === currentUser?.uid;
          if (!belongsToUser) return false;
        }

        if (!term) return true;

        return [
          task.id,
          task.title,
          task.description,
          task.beneficiaryName,
          task.employerName,
          task.assignedToName,
          nameOfBeneficiary(task.beneficiaryId),
          nameOfEmployer(task.employerId),
          nameOfUser(task.assignedTo),
          statusLabels[task.status] || task.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        const aDate = a.dueDate || '9999-99-99';
        const bDate = b.dueDate || '9999-99-99';
        return aDate.localeCompare(bDate);
      });
  }, [items, search, isAdmin, currentUser, beneficiaries, employers, users]);

  return (
    <section className="page-card tasks-page">
      <div className="page-heading">
        <div>
          <h1>Списък Задачи</h1>
          <div className="breadcrumb">Начало / Списък Задачи / {view === 'add' ? 'Добави' : 'Листване'}</div>
        </div>
        <button className="btn btn-primary" onClick={add}>+ Добави</button>
      </div>

      <div className="module-tabs">
        <button className={view === 'list' ? 'active' : ''} onClick={() => { reset(); setView('list'); }}>
          Листване
        </button>
        <button className={view === 'add' ? 'active' : ''} onClick={add}>
          {editing ? 'Редактиране' : 'Добави'}
        </button>
      </div>

      {view === 'add' && (
        <div className="module-form">
          <h2>{editing ? 'Редактиране на задача' : 'Нова задача'}</h2>

          <form onSubmit={save} className="form-grid">
            <label>
              Задача *
              <input name="title" value={form.title} onChange={change} required />
            </label>

            <label>
              Срок
              <input type="date" name="dueDate" value={form.dueDate} onChange={change} />
            </label>

            <label>
              Бенефициент
              <select name="beneficiaryId" value={form.beneficiaryId} onChange={change}>
                <option value="">— Без бенефициент —</option>
                {beneficiaryList.map((item) => (
                  <option key={item.key} value={item.key}>
                    № {item.id || item.key} — {item.displayName || 'Без име'}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Работодател
              <select name="employerId" value={form.employerId} onChange={change}>
                <option value="">— Без работодател —</option>
                {employerList.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Отговорен потребител
              <select name="assignedTo" value={form.assignedTo} onChange={change}>
                <option value="">— Неразпределена —</option>
                {userList.map((item) => (
                  <option key={item.uid} value={item.uid}>
                    {item.name || item.email || item.uid}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Статус
              <select name="status" value={form.status} onChange={change}>
                <option value="new">Нова</option>
                <option value="in-progress">В процес</option>
                <option value="done">Приключена</option>
                <option value="cancelled">Отказана</option>
              </select>
            </label>

            <label className="full-width-field">
              Описание
              <textarea name="description" value={form.description} onChange={change} rows="4" />
            </label>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Записване...' : editing ? 'Запази промените' : 'Запази'}
              </button>
              <button type="button" className="btn btn-light" onClick={() => { reset(); setView('list'); }}>
                Отказ
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'list' && (
        <>
          <div className="table-toolbar">
            <h2>Листване</h2>
            <input
              className="search-input"
              placeholder="Търси задача, бенефициент, работодател..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Задача</th>
                  <th>Бенефициент</th>
                  <th>Работодател</th>
                  <th>Отговорен</th>
                  <th>Срок</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="empty-row">Зареждане...</td></tr>
                ) : list.length ? (
                  list.map((task) => (
                    <tr key={task.id}>
                      <td>{task.id}</td>
                      <td>
                        <strong>{task.title || task.description || '—'}</strong>
                        {task.description && task.title && <div className="task-description">{task.description}</div>}
                      </td>
                      <td>{task.beneficiaryId ? nameOfBeneficiary(task.beneficiaryId) : (task.beneficiaryName || '—')}</td>
                      <td>{task.employerId ? nameOfEmployer(task.employerId) : (task.employerName || '—')}</td>
                      <td>{task.assignedTo ? nameOfUser(task.assignedTo) : (task.assignedToName || '—')}</td>
                      <td>{task.dueDate || task.date || '—'}</td>
                      <td><span className="status-badge">{statusLabels[task.status] || task.status || 'Нова'}</span></td>
                      <td>
                        <button className="table-action edit-action" onClick={() => edit(task)}>Редактирай</button>{' '}
                        <button className="table-action danger" onClick={() => del(task.id)} disabled={saving}>Изтрий</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="8" className="empty-row">Няма задачи.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>Брой записи: {list.length}</span>
          </div>
        </>
      )}
    </section>
  );
}
