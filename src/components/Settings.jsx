import { useEffect, useState } from 'react';
import { get, ref, set } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { logAudit } from '../utils/audit';

const defaults = {
  compactTables: false,
  notifications: true,
  confirmDelete: true,
  rememberMenu: true,
};

const systemDefaults = {
  taskDefaultStatus: 'new',
  taskDefaultDueDays: 7,
};

const statusText = {
  new: 'Нова',
  'in-progress': 'В процес',
  done: 'Приключена',
  cancelled: 'Отказана',
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
  const [system, setSystem] = useState(systemDefaults);
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [systemSaving, setSystemSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    localStorage.setItem('caritasSettings', JSON.stringify(settings));
    document.documentElement.dataset.density = settings.compactTables ? 'compact' : 'normal';
  }, [settings]);

  useEffect(() => {
    const loadSystem = async () => {
      try {
        const snapshot = await get(ref(database, 'settings/system'));
        if (snapshot.exists()) setSystem({ ...systemDefaults, ...snapshot.val() });
      } catch (error) {
        console.error(error);
      }
    };
    loadSystem();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const loadAudit = async () => {
      try {
        setAuditLoading(true);
        const snapshot = await get(ref(database, 'auditLogs'));
        if (!snapshot.exists()) {
          setAudit([]);
          return;
        }
        const data = snapshot.val();
        setAudit(
          Object.entries(data)
            .map(([id, item]) => ({ id, ...item }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 100)
        );
      } catch (error) {
        console.error(error);
      } finally {
        setAuditLoading(false);
      }
    };
    loadAudit();
  }, [isAdmin]);

  const change = (name) => {
    setSettings((current) => ({ ...current, [name]: !current[name] }));
  };

  const reset = () => {
    setSettings(defaults);
    setMessage('Личните настройки са възстановени.');
  };

  const saveSystem = async () => {
    if (!isAdmin) return;
    try {
      setSystemSaving(true);
      setMessage('');
      await set(ref(database, 'settings/system'), {
        taskDefaultStatus: system.taskDefaultStatus,
        taskDefaultDueDays: Math.max(0, Number(system.taskDefaultDueDays) || 0),
        updatedBy: currentUser?.uid || '',
        updatedAt: Date.now(),
      });
      await logAudit({
        user: currentUser,
        action: 'Промяна на системни настройки',
        module: 'Настройки',
        details: `Начален статус: ${statusText[system.taskDefaultStatus] || system.taskDefaultStatus}; срок: ${system.taskDefaultDueDays} дни`,
      });
      setMessage('Системните настройки са записани.');
    } catch (error) {
      setMessage('Грешка при записване: ' + error.message);
    } finally {
      setSystemSaving(false);
    }
  };

  const formatDate = (timestamp) => timestamp
    ? new Date(timestamp).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  return (
    <section className="page-card settings-page">
      <div className="page-heading">
        <div>
          <h1>Настройки</h1>
          <div className="breadcrumb">Начало / Настройки</div>
        </div>
        <button className="btn btn-light" onClick={reset}>Възстанови стандартните</button>
      </div>

      {message && <div className="alert settings-message">{message}</div>}

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-heading">
            <h2>Моят профил</h2>
            <span className="status-badge status-active">Активен</span>
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
          <div className="settings-card-heading"><h2>Интерфейс</h2></div>
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
          <div className="settings-card-heading"><h2>Известия и действия</h2></div>
          <label className="settings-switch">
            <span><strong>Известия</strong><small>Разрешава визуални известия в панела.</small></span>
            <input type="checkbox" checked={settings.notifications} onChange={() => change('notifications')} />
          </label>
          <label className="settings-switch">
            <span><strong>Потвърждение при изтриване</strong><small>Показва въпрос преди изтриване на запис.</small></span>
            <input type="checkbox" checked={settings.confirmDelete} onChange={() => change('confirmDelete')} />
          </label>
        </div>

        {isAdmin && (
          <div className="settings-card">
            <div className="settings-card-heading">
              <h2>Настройки на задачите</h2>
              <span className="settings-admin-label">АДМИН</span>
            </div>
            <label className="settings-field">
              <span>Начален статус</span>
              <select value={system.taskDefaultStatus} onChange={(e) => setSystem((x) => ({ ...x, taskDefaultStatus: e.target.value }))}>
                <option value="new">Нова</option>
                <option value="in-progress">В процес</option>
                <option value="done">Приключена</option>
                <option value="cancelled">Отказана</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Стандартен срок (дни)</span>
              <input type="number" min="0" max="365" value={system.taskDefaultDueDays} onChange={(e) => setSystem((x) => ({ ...x, taskDefaultDueDays: e.target.value }))} />
            </label>
            <button className="btn btn-primary settings-save-btn" onClick={saveSystem} disabled={systemSaving}>
              {systemSaving ? 'Записване...' : 'Запази системните настройки'}
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="settings-card">
            <div className="settings-card-heading"><h2>Роли и права</h2></div>
            <div className="permission-table">
              <div className="permission-row permission-head"><span>Модул</span><span>Администратор</span><span>Потребител</span></div>
              {[
                ['Табло', 'Пълен достъп', 'Собствени задачи'],
                ['Задачи', 'Пълен достъп', 'Създаване / редакция на достъпните'],
                ['Бенефициенти', 'Пълен достъп', 'Достъп'],
                ['Работодатели', 'Пълен достъп', 'Достъп'],
                ['Export', 'Пълен достъп', '—'],
                ['Потребители', 'Пълен достъп', '—'],
                ['Настройки', 'Пълен достъп', 'Лични'],
              ].map(([module, admin, user]) => (
                <div className="permission-row" key={module}><span>{module}</span><span className="permission-yes">{admin}</span><span>{user}</span></div>
              ))}
            </div>
            <small className="settings-note">Ролите се управляват от модула „Потребители“. Системните правила във Firebase определят достъпа до данните.</small>
          </div>
        )}

        <div className="settings-card">
          <div className="settings-card-heading"><h2>Система</h2></div>
          <div className="settings-info-row"><span>Потребителски UID</span><code>{currentUser?.uid || '—'}</code></div>
          <div className="settings-info-row"><span>Роля</span><strong>{isAdmin ? 'Администратор' : 'Потребител'}</strong></div>
          <div className="settings-info-row"><span>Сесия</span><span className="status-badge status-active">Входът е активен</span></div>
          <div className="settings-info-row"><span>Версия</span><strong>Caritas Portal 1.0</strong></div>
        </div>

        {isAdmin && (
          <div className="settings-card settings-audit-card">
            <div className="settings-card-heading">
              <h2>История на действията</h2>
              <span className="settings-admin-label">ПОСЛЕДНИ 100</span>
            </div>
            <div className="audit-wrap">
              <table className="admin-table audit-table">
                <thead><tr><th>Дата</th><th>Потребител</th><th>Действие</th><th>Модул</th><th>Детайли</th></tr></thead>
                <tbody>
                  {auditLoading ? (
                    <tr><td colSpan="5" className="empty-row">Зареждане...</td></tr>
                  ) : audit.length ? audit.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.userName || item.userId || '—'}</td>
                      <td><strong>{item.action || '—'}</strong></td>
                      <td>{item.module || '—'}</td>
                      <td>{item.details || '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" className="empty-row">Все още няма записани действия.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
