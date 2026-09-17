import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, get, remove } from 'firebase/database';
import Sidebar from './Sidebar';

export default function Dashboard() {
  const { currentUser, isAdmin, logout } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setError('');

    try {
      const requestsRef = ref(database, 'requests');
      const snapshot = await get(requestsRef);

      if (!snapshot.exists()) {
        setRequests([]);
        return;
      }

      const data = snapshot.val();
      const list = Object.entries(data).map(([id, value]) => ({
        id,
        ...(value || {}),
      }));

      setRequests(
        isAdmin
          ? list
          : list.filter(
              (request) =>
                request.createdBy === currentUser.uid ||
                request.assignedTo === currentUser.uid
            )
      );
    } catch (err) {
      console.error('Error loading requests:', err);
      setError('Неуспешно зареждане на заявките. Провери Firebase Security Rules.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm('Сигурен ли си, че искаш да изтриеш тази заявка?')) return;

    try {
      await remove(ref(database, `requests/${id}`));
      await loadRequests();
    } catch (err) {
      console.error('Error deleting request:', err);
      setError('Заявката не може да бъде изтрита. Провери Firebase Security Rules.');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '20px', background: '#f5f5f5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Основно табло</h2>
          <button onClick={logout} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Изход
          </button>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Списък със заявки</h3>

          {error && (
            <div style={{ color: '#b02a37', background: '#f8d7da', padding: '12px', borderRadius: '4px', marginTop: '15px' }}>
              {error}
            </div>
          )}

          {loading ? (
            <p style={{ marginTop: '15px' }}>Зареждане...</p>
          ) : requests.length === 0 ? (
            <p style={{ marginTop: '15px' }}>Няма заявки за показване.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
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
                  {requests.map((request) => (
                    <tr key={request.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{request.id}</td>
                      <td style={{ padding: '10px' }}>{request.description || '—'}</td>
                      <td style={{ padding: '10px' }}>{request.date || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ background: '#17a2b8', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                          {request.status || 'Няма статус'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '10px' }}>
                          <button onClick={() => handleDelete(request.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                            Изтрий
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
