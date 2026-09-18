import { useEffect, useState } from 'react';
import { get, ref } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const options = [
  { value: 'beneficiaries', label: 'Бенефициенти' },
  { value: 'employers', label: 'Работодатели' },
  { value: 'requests', label: 'Задачи' },
  { value: 'users', label: 'Потребители' },
];

const headers = {
  beneficiaries: ['ID', 'Собствено име', 'Бащино име', 'Фамилия', 'Пол', 'Дата на раждане', 'Идентификатор', 'Статус'],
  employers: ['ID', 'Работодател', 'Лице за контакт', 'Телефон', 'E-mail', 'Адрес', 'Статус', 'Бележки'],
  requests: ['ID', 'Задача', 'Описание', 'Бенефициент', 'Работодател', 'Отговорен потребител', 'Срок', 'Статус', 'Създадена'],
  users: ['UID', 'Име', 'E-mail', 'Телефон', 'Роля', 'Статус'],
};

const valueRows = (type, data) => {
  return Object.entries(data || {}).map(([id, x]) => {
    if (type === 'beneficiaries') return [x.id || id, x.firstName, x.middleName, x.lastName, x.gender === 'male' ? 'Мъж' : x.gender === 'female' ? 'Жена' : '', x.birthDate, x.identifier, x.status === 'archived' ? 'Архивиран' : 'Активен'];
    if (type === 'employers') return [id, x.name, x.contact, x.phone, x.email, x.address, x.status === 'archived' ? 'Архивиран' : 'Активен', x.notes];
    if (type === 'requests') return [id, x.title || '', x.description || '', x.beneficiaryName || '', x.employerName || '', x.assignedToName || '', x.dueDate || x.date || '', x.status || '', x.createdAt ? new Date(x.createdAt).toLocaleString('bg-BG') : ''];
    return [id, x.name, x.email, x.phone, x.role === 'admin' ? 'Администратор' : 'Потребител', x.active === false ? 'Неактивен' : 'Активен'];
  });
};

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCsv(filename, columns, rows) {
  const csv = '\ufeff' + [columns, ...rows].map(row => row.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Export() {
  const { isAdmin } = useAuth();
  const [type, setType] = useState('beneficiaries');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const snapshot = await get(ref(database, type));
      setData(snapshot.exists() ? snapshot.val() : {});
    } catch (error) {
      alert('Грешка при зареждане на данните: ' + error.message);
      setData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [type]);

  const exportData = () => {
    const rows = valueRows(type, data);
    const label = options.find(x => x.value === type)?.label || type;
    const filename = 'caritas-' + type + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    downloadCsv(filename, headers[type], rows);
  };

  if (!isAdmin) {
    return <section className="page-card"><div className="page-heading"><div><h1>Export</h1><div className="breadcrumb">Начало / Export</div></div></div><div className="alert">Нямаш права за експорт на данни.</div></section>;
  }

  const count = Object.keys(data).length;

  return (
    <section className="page-card export-page">
      <div className="page-heading">
        <div><h1>Export</h1><div className="breadcrumb">Начало / Export</div></div>
        <button className="btn btn-primary" onClick={exportData} disabled={loading}>⇩ Изтегли CSV</button>
      </div>

      <div className="module-form">
        <h2>Експорт на данни</h2>
        <p className="form-help">Избери модул и изтегли текущите записи като CSV файл. Файлът е с UTF-8 кодиране и е подходящ за отваряне в Excel.</p>
        <div className="form-grid">
          <label>Модул
            <select value={type} onChange={e => setType(e.target.value)}>
              {options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>Записи
            <input value={loading ? 'Зареждане...' : count} readOnly />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={exportData} disabled={loading || count === 0}>Изтегли CSV</button>
          </div>
        </div>
      </div>

      <div className="table-toolbar"><h2>Преглед</h2><span>{loading ? 'Зареждане...' : count + ' записа'}</span></div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr>{headers[type].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={headers[type].length} className="empty-row">Зареждане...</td></tr> :
              valueRows(type, data).slice(0, 10).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell || '—'}</td>)}</tr>)}
            {!loading && count === 0 && <tr><td colSpan={headers[type].length} className="empty-row">Няма записи за експорт.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
