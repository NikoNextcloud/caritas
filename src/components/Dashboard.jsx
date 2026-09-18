import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, get, remove, query, orderByChild, equalTo } from 'firebase/database';
import Sidebar from './Sidebar';
import Beneficiaries from './Beneficiaries';
import Employers from './Employers';
import Tasks from './Tasks';
import Users from './Users';
import Export from './Export';

const statusLabels = { new: 'Нова', 'in-progress': 'В процес', done: 'Приключена', cancelled: 'Отказана' };

function Header({ onLogout, currentUser, onMenuToggle }) {
  const displayName = currentUser?.displayName || currentUser?.email || 'Потребител';
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-btn" onClick={onMenuToggle} aria-label="Отвори меню">☰</button>
      </div>
      <div className="topbar-actions">
        <button className="notification-btn" title="Известия">♧<span className="notification-badge">0</span></button>
        <div className="topbar-user"><span className="avatar">{displayName.charAt(0).toUpperCase()}</span><span>{displayName}</span></div>
        <button className="logout-link" onClick={onLogout}>Изход</button>
      </div>
    </header>
  );
}

function TablePage({ title, children, actions }) {
  return <section className="page-card"><div className="page-heading"><div><h1>{title}</h1><div className="breadcrumb">Начало / {title}</div></div>{actions}</div>{children}</section>;
}

export default function Dashboard() {
  const { currentUser, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 600);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ beneficiaries: 0, employers: 0, users: 0 });
  const [error, setError] = useState('');
  const [loadingStats, setLoadingStats] = useState(true);

  const toggleMenu = () => setCollapsed(v => !v);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.innerWidth <= 600) setCollapsed(true);
  };

  const loadDashboard = useCallback(async () => {
    if (!currentUser) return;
    try {
      setError('');
      setLoadingStats(true);

      const reads = [
        get(ref(database, 'beneficiaries')),
        get(ref(database, 'employers')),
        isAdmin ? get(ref(database, 'users')) : Promise.resolve(null),
      ];

      const [beneficiariesSnap, employersSnap, usersSnap] = await Promise.all(reads);

      setStats({
        beneficiaries: beneficiariesSnap.exists() ? Object.keys(beneficiariesSnap.val()).length : 0,
        employers: employersSnap.exists() ? Object.keys(employersSnap.val()).length : 0,
        users: usersSnap?.exists() ? Object.keys(usersSnap.val()).length : 0,
      });

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

      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRequests(list);
    } catch (err) {
      console.error(err);
      setError('Неуспешно зареждане на таблото. Провери Firebase Security Rules.');
      setRequests([]);
    } finally {
      setLoadingStats(false);
    }
  }, [currentUser, isAdmin]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleDelete = async (id) => {
    if (!isAdmin || !confirm('Сигурен ли си, че искаш да изтриеш тази заявка?')) return;
    try {
      await remove(ref(database, `requests/${id}`));
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError('Заявката не може да бъде изтрита.');
    }
  };

  const openTasks = () => setActiveTab('tasks');

  const renderDashboard = () => (
    <TablePage title="Основно табло" actions={<button className="btn btn-primary" onClick={openTasks}>+ Нова задача</button>}>
      {error && <div className="alert">{error}</div>}
      <div className="stats-grid">
        <div className="stat-card"><span>Заявки</span><strong>{loadingStats ? '...' : requests.length}</strong></div>
        <div className="stat-card"><span>Бенефициенти</span><strong>{loadingStats ? '...' : stats.beneficiaries}</strong></div>
        <div className="stat-card"><span>Работодатели</span><strong>{loadingStats ? '...' : stats.employers}</strong></div>
        {isAdmin && <div className="stat-card"><span>Потребители</span><strong>{loadingStats ? '...' : stats.users}</strong></div>}
      </div>
      <div className="table-toolbar"><h2>Последни задачи</h2><button className="btn btn-light" onClick={openTasks}>Виж всички</button></div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Задача</th><th>Бенефициент</th><th>Работодател</th><th>Срок</th><th>Статус</th>{isAdmin && <th>Действия</th>}</tr></thead>
          <tbody>
            {requests.slice(0, 10).map(r => (
              <tr key={r.id}>
                <td><strong>{r.title || r.description || '—'}</strong></td>
                <td>{r.beneficiaryName || '—'}</td>
                <td>{r.employerName || '—'}</td>
                <td>{r.dueDate || r.date || '—'}</td>
                <td><span className="status-badge">{statusLabels[r.status] || r.status || '—'}</span></td>
                {isAdmin && <td><button className="table-action danger" onClick={() => handleDelete(r.id)}>Изтрий</button></td>}
              </tr>
            ))}
            {!requests.length && <tr><td colSpan={isAdmin ? 6 : 5} className="empty-row">{loadingStats ? 'Зареждане...' : 'Няма задачи.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pagination"><span>Показани: {Math.min(requests.length, 10)} от {requests.length}</span><button className="btn btn-light" onClick={openTasks}>Отвори списъка</button></div>
    </TablePage>
  );

  const renderSimple = (title, text) => <TablePage title={title} actions={<button className="btn btn-primary">+ Добави</button>}><div className="empty-module"><div className="empty-icon">▦</div><h2>{title}</h2><p>{text}</p></div></TablePage>;

  const renderContent = () => {
    if (activeTab === 'beneficiaries') return <Beneficiaries user={currentUser} />;
    if (activeTab === 'tasks') return <Tasks />;
    if (activeTab === 'employers') return <Employers />;
    if (activeTab === 'export') return <Export />;
    if (activeTab === 'users') return <Users />;
    if (activeTab === 'settings') return renderSimple('Настройки', 'Настройки на системата.');
    return renderDashboard();
  };

  return (
    <div className="admin-layout">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} collapsed={collapsed} onToggle={toggleMenu} />
      {!collapsed && <button className="sidebar-backdrop" aria-label="Затвори менюто" onClick={() => setCollapsed(true)} />}
      <div className="admin-main">
        <Header onLogout={logout} currentUser={currentUser} onMenuToggle={toggleMenu} />
        <main className="content-area">{renderContent()}</main>
      </div>
    </div>
  );
}
