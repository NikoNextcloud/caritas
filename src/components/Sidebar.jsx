import { useAuth } from '../contexts/AuthContext';

const menu = [
  { id: 'dashboard', label: 'Основно табло', icon: '▣' },
  { id: 'tasks', label: 'Списък Задачи', icon: '☷' },
  { id: 'beneficiaries', label: 'Бенефициенти', icon: '♙' },
  { id: 'employers', label: 'Работодатели', icon: '▤' },
  { id: 'export', label: 'Export', icon: '⇩' },
];

export default function Sidebar({ activeTab, onTabChange, collapsed, onToggle }) {
  const { userRole } = useAuth();

  return (
    <aside className={`caritas-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img className="sidebar-logo" src="/caritas-logo.svg" alt="Лого" />
        <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Отвори меню' : 'Свий меню'}>☰</button>
      </div>

      {!collapsed && <div className="sidebar-user"><span className="online-dot" />Потребител</div>}

      <nav className="sidebar-nav">
        {menu.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            title={item.label}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}

        {userRole === 'admin' && (
          <>
            {!collapsed && <div className="sidebar-section">АДМИНИСТРАЦИЯ</div>}
            <button className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => onTabChange('users')} title="Потребители">
              <span className="sidebar-icon">♟</span>
              {!collapsed && <span>Потребители</span>}
            </button>
            <button className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => onTabChange('settings')} title="Настройки">
              <span className="sidebar-icon">⚙</span>
              {!collapsed && <span>Настройки</span>}
            </button>
          </>
        )}
      </nav>
    </aside>
  );
}
