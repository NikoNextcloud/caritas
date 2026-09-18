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
        <div className="brand-mark">C</div>
        {!collapsed && <span>Caritas</span>}
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Свиване на менюто">☰</button>
      </div>

      {!collapsed && <div className="sidebar-user"><span className="online-dot" />Потребител</div>}

      <nav className="sidebar-nav">
        {menu.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}

        {userRole === 'admin' && (
          <>
            {!collapsed && <div className="sidebar-section">АДМИНИСТРАЦИЯ</div>}
            <button className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => onTabChange('users')} title={collapsed ? 'Потребители' : undefined}>
              <span className="sidebar-icon">♟</span>{!collapsed && <span>Потребители</span>}
            </button>
            <button className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => onTabChange('settings')} title={collapsed ? 'Настройки' : undefined}>
              <span className="sidebar-icon">⚙</span>{!collapsed && <span>Настройки</span>}
            </button>
          </>
        )}
      </nav>
    </aside>
  );
}
