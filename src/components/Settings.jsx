import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const defaults = {
  compactTables: false,
  notifications: true,
  confirmDelete: true,
  rememberMenu: true,
};

export default function Settings() {
  const { currentUser, isAdmin } = useAuth();
  const [settings, setSettings] = useState(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('caritasSettings') || '{}') };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem('caritasSettings', JSON.stringify(settings));
    document.documentElement.dataset.density = settings.compactTables ? 'compact' : 'normal';
  }, [settings]);

  const change = (name) => {
    setSettings((current) => ({ ...current, [name]: !current[name] }));
  };

  const reset = () => {
    setSettings(defaults);
  };

  return (
    <section className="page-card settings-page">
      <div className="page-heading">
        <div>
          <h1>Настройки</h1>
          <div className="breadcrumb">Начало / Настройки</div>
        </div>
        <button className="btn btn-light" onClick={reset}>Възстанови стандартните</button>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-heading">
            <h2>Моят профил</h2>
            <span className={`status-badge status-active`}>Активен</span>
          </div>
          <div className="settings-profile">
            <div className="settings-avatar">{(currentUser?.displayName || currentUser?.email || 'П').charAt(0).toUpperCase()}</div>
            <div>
              <strong>{currentUser?.displayName || 'Потребител'}</strong>
              <span>{currentUser?.email || '—'}</span>
              <small>{isAdmin ? 'Администратор' : 'Потребител'}</small>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-heading">
            <h2>Интерфейс</h2>
          </div>
          <label className="settings-switch">
            <span><strong>Компактни таблици</strong><small>Повече записи на един екран.</small></span>
            <input type="checkbox" checked={settings.compactTables} onChange={() => change('compactTables')} />
          </label>
          <label className="settings-switch">
            <span><strong>Запомняй менюто</strong><small>Запазва предпочитанието за страничното меню.</small></span>
            <input type="checkbox" checked={settings.rememberMenu} onChange={() => change('rememberMenu')} />
          </label>
        </div>

        <div className="settings-card">
          <div className="settings-card-heading">
            <h2>Известия и действия</h2>
          </div>
          <label className="settings-switch">
            <span><strong>Известия</strong><small>Разрешава визуални известия в панела.</small></span>
            <input type="checkbox" checked={settings.notifications} onChange={() => change('notifications')} />
          </label>
          <label className="settings-switch">
            <span><strong>Потвърждение при изтриване</strong><small>Показва въпрос преди изтриване на запис.</small></span>
            <input type="checkbox" checked={settings.confirmDelete} onChange={() => change('confirmDelete')} />
          </label>
        </div>

        <div className="settings-card">
          <div className="settings-card-heading">
            <h2>Система</h2>
          </div>
          <div className="settings-info-row"><span>Потребителски UID</span><code>{currentUser?.uid || '—'}</code></div>
          <div className="settings-info-row"><span>Роля</span><strong>{isAdmin ? 'Администратор' : 'Потребител'}</strong></div>
          <div className="settings-info-row"><span>Сесия</span><span className="status-badge status-active">Входът е активен</span></div>
        </div>
      </div>
    </section>
  );
}
