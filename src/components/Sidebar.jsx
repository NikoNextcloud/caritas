import { useAuth } from '../contexts/AuthContext';

export default function Sidebar({ activeTab, onTabChange }) {
  const { userRole } = useAuth();

  const itemStyle = (tab) => ({
    padding: '10px',
    marginBottom: '10px',
    background: activeTab === tab ? '#34495e' : 'transparent',
    borderRadius: '4px',
    cursor: 'pointer',
  });

  return (
    <div style={{ width: '250px', background: '#2c3e50', color: 'white', minHeight: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <h2 style={{ marginBottom: '30px' }}>Caritas</h2>
      <nav>
        <div style={itemStyle('dashboard')} onClick={() => onTabChange('dashboard')}>📊 Основно табло</div>
        <div style={itemStyle('tasks')} onClick={() => onTabChange('tasks')}>📝 Списък Задачи</div>
        <div style={itemStyle('beneficiaries')} onClick={() => onTabChange('beneficiaries')}>👥 Бенефициенти</div>
        <div style={itemStyle('employers')} onClick={() => onTabChange('employers')}>🏢 Работодатели</div>
        <div style={itemStyle('export')} onClick={() => onTabChange('export')}>📈 Export</div>
        {userRole === 'admin' && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #34495e' }}>
            <div style={{ fontSize: '12px', color: '#95a5a6', marginBottom: '10px' }}>АДМИНИСТРАЦИЯ</div>
            <div style={itemStyle('settings')} onClick={() => onTabChange('settings')}>⚙️ Настройки</div>
            <div style={itemStyle('users')} onClick={() => onTabChange('users')}>👤 Потребители</div>
          </div>
        )}
      </nav>
    </div>
  );
}
