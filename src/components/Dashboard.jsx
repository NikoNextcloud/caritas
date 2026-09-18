import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, get, remove, query, orderByChild, equalTo } from 'firebase/database';
import Sidebar from './Sidebar';
import Beneficiaries from './Beneficiaries';
import Employers from './Employers';
import Tasks from './Tasks';

function Header({ onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-title">Caritas Administration</div>
      <div className="topbar-actions">
        <button className="notification-btn" title="Известия">♧<span className="notification-badge">0</span></button>
        <div className="topbar-user"><span className="avatar">A</span><span>Администратор</span></div>
        <button className="logout-link" onClick={onLogout}>Изход</button>
      </div>
    </header>
  );
}

function TablePage({ title, children, actions }) {
  return (
    <section className="page-card">
      <div className="page-heading">
        <div><h1>{title}</h1><div className="breadcrumb">Начало / {title}</div></div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const { currentUser, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    if (!currentUser) return;
    try {
      setError('');
      let list = [];
      if (isAdmin) {
        const snapshot = await get(ref(database, 'requests'));
        if (snapshot.exists()) {
          const data = snapshot.val();
          list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        }
      } else {
        const createdQuery = query(ref(database, 'requests'), orderByChild('createdBy'), equalTo(currentUser.uid));
        const assignedQuery = query(ref(database, 'requests'), orderByChild('assignedTo'), equalTo(currentUser.uid));
        const [createdSnapshot, assignedSnapshot] = await Promise.all([get(createdQuery), get(assignedQuery)]);
        const byId = new Map();
        [createdSnapshot, assignedSnapshot].forEach(snapshot => {
          if (!snapshot.exists()) return;
          const data = snapshot.val();
          Object.keys(data).forEach(key => byId.set(key, { id: key, ...data[key] }));
        });
        list = Array.from(byId.values());
      }
      setRequests(list);
    } catch (err) {
      console.error(err);
      setError('Неуспешно зареждане на заявките. Провери Firebase Security Rules.');
      setRequests([]);
    }
  }, [currentUser, isAdmin]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleDelete = async (id) => {
    if (!isAdmin || !confirm('Сигурен ли си, че искаш да изтриеш тази заявка?')) return;
    try {
      await remove(ref(database, `requests/${id}`));
      await loadRequests();
    } catch (err) {
      console.error(err);
      setError('Заявката не може да бъде изтрита.');
    }
  };

  const renderDashboard = () => (
    <TablePage title="Основно табло" actions={<button className="btn btn-primary">+ Нова заявка</button>}>
      {error && <div className="alert">{error}</div>}
      <div className="stats-grid">
        <div className="stat-card"><span>Заявки</span><strong>{requests.length}</strong></div>
        <div className="stat-card"><span>Бенефициенти</span><strong>—</strong></div>
        <div className="stat-card"><span>Работодатели</span><strong>—</strong></div>
        <div className="stat-card"><span>Потребители</span><strong>—</strong></div>
      </div>
      <div className="table-toolbar"><h2>Списък със заявки</h2><button className="btn btn-light">Филтри</button></div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>ID</th><th>Описание</th><th>Дата</th><th>Статус</th>{isAdmin && <th>Действия</th>}</tr></thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.description || '—'}</td><td>{r.date || '—'}</td>
                <td><span className="status-badge">{r.status || '—'}</span></td>
                {isAdmin && <td><button className="table-action danger" onClick={() => handleDelete(r.id)}>Изтрий</button></td>}
              </tr>
            ))}
            {!requests.length && <tr><td colSpan={isAdmin ? 5 : 4} className="empty-row">Няма заявки.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pagination"><span>Брой записи: {requests.length}</span><div><button>5</button><button>10</button><button className="selected">20</button><button>30</button><button>50</button></div></div>
    </TablePage>
  );

  const renderSimple = (title, text) => (
    <TablePage title={title} actions={<button className="btn btn-primary">+ Добави</button>}>
      <div className="empty-module"><div className="empty-icon">▦</div><h2>{title}</h2><p>{text}</p></div>
    </TablePage>
  );

  const renderContent = () => {
    if (activeTab === 'beneficiaries') return <Beneficiaries />;
    if (activeTab === 'tasks') return <Tasks />;
    if (activeTab === 'employers') return <Employers />;
    if (activeTab === 'export') return renderSimple('Export', 'Експорт на данните.');
    if (activeTab === 'users') return renderSimple('Потребители', 'Управление на потребителите.');
    if (activeTab === 'settings') return renderSimple('Настройки', 'Настройки на системата.');
    return renderDashboard();
  };

  return (
    <div className="admin-layout">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <div className="admin-main">
        <Header onLogout={logout} />
        <main className="content-area">{renderContent()}</main>
      </div>
    </div>
  );
}
