import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, get, remove, query, orderByChild, equalTo } from 'firebase/database';
import Sidebar from './Sidebar';

export default function Dashboard() {
  const { currentUser, isAdmin, logout } = useAuth();
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
        const createdQuery = query(
          ref(database, 'requests'),
          orderByChild('createdBy'),
          equalTo(currentUser.uid)
        );
        const assignedQuery = query(
          ref(database, 'requests'),
          orderByChild('assignedTo'),
          equalTo(currentUser.uid)
        );

        const [createdSnapshot, assignedSnapshot] = await Promise.all([
          get(createdQuery),
          get(assignedQuery),
        ]);

        const byId = new Map();
        [createdSnapshot, assignedSnapshot].forEach(snapshot => {
          if (!snapshot.exists()) return;
          const data = snapshot.val();
          Object.keys(data).forEach(key => {
            byId.set(key, { id: key, ...data[key] });
          });
        });
        list = Array.from(byId.values());
      }

      setRequests(list);
    } catch (err) {
      console.error('Error loading requests:', err);
      setError('Неуспешно зареждане на заявките. Провери Firebase Security Rules.');
      setRequests([]);
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!confirm('Сигурен ли си, че искаш да изтриеш тази заявка?')) return;

    try {
      await remove(ref(database, `requests/${id}`));
      await loadRequests();
    } catch (err) {
      console.error('Error deleting request:', err);
      setError('Заявката не може да бъде изтрита.');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '20px', background: '#f5f5f5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Основно табло</h2>
          <button onClick={logout} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Изход</button>
        </div>

        {error && (
          <div style={{ background: '#fff3cd', color: '#856404', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Списък със заявки</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Описание</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Дата</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Статус</th>
                {isAdmin && <th style={{ padding: '10px' }}>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{r.id}</td>
                  <td style={{ padding: '10px' }}>{r.description || '—'}</td>
                  <td style={{ padding: '10px' }}>{r.date || '—'}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ background: '#17a2b8', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{r.status || '—'}</span>
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => handleDelete(r.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Изтрий</button>
                    </td>
                  )}
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} style={{ padding: '20px', textAlign: 'center', color: '#777' }}>
                    Няма заявки.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
