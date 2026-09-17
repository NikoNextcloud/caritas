import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const { userRole } = useAuth();

  return (
    <div style={{ width: '250px', background: '#2c3e50', color: 'white', minHeight: '100vh', padding: '20px' }}>
      <h2 style={{ marginBottom: '30px' }}>Caritas</h2>
      <nav>
        <div style={{ padding: '10px', marginBottom: '10px', background: '#34495e', borderRadius: '4px', cursor: 'pointer' }}>📊 Основно табло</div>
        <div style={{ padding: '10px', marginBottom: '10px', cursor: 'pointer' }}>📝 Списък Задачи</div>
        <div style={{ padding: '10px', marginBottom: '10px', cursor: 'pointer' }}>👥 Бенефициенти</div>
        <div style={{ padding: '10px', marginBottom: '10px', cursor: 'pointer' }}>🏢 Работодатели</div>
        <div style={{ padding: '10px', marginBottom: '10px', cursor: 'pointer' }}>📈 Export</div>
        {userRole === 'admin' && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #34495e' }}>
            <div style={{ fontSize: '12px', color: '#95a5a6', marginBottom: '10px' }}>АДМИНИСТРАЦИЯ</div>
            <div style={{ padding: '10px', marginBottom: '10px', cursor: 'pointer' }}>⚙️ Настройки</div>
            <div style={{ padding: '10px', marginBottom: '10px', cursor: 'pointer' }}>👤 Потребители</div>
          </div>
        )}
      </nav>
    </div>
  );
}