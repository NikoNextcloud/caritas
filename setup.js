const fs = require('fs');
const path = require('path');

// Create directories
const dirs = ['src/components', 'src/contexts', 'public'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Package.json
fs.writeFileSync('package.json', JSON.stringify({
  "name": "caritas-portal",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^10.7.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}, null, 2));

// vite.config.js
fs.writeFileSync('vite.config.js', `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`);

// index.html
fs.writeFileSync('index.html', `<!doctype html>
<html lang="bg">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Caritas Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`);

// src/main.jsx
fs.writeFileSync('src/main.jsx', `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`);

// src/index.css
fs.writeFileSync('src/index.css', `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}`);

// src/firebase.js
fs.writeFileSync('src/firebase.js', `import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "ЗАМЕНИ_С_ТВОЯТА_API_KEY",
  authDomain: "caritas-vitania.firebaseapp.com",
  databaseURL: "https://caritas-vitania-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "caritas-vitania",
  storageBucket: "caritas-vitania.appspot.com",
  messagingSenderId: "ЗАМЕНИ",
  appId: "ЗАМЕНИ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
`);

// src/contexts/AuthContext.jsx
fs.writeFileSync('src/contexts/AuthContext.jsx', `import { createContext, useContext, useState, useEffect } from 'react';
import { auth, database } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userRef = ref(database, \`users/\${user.uid}\`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          setUserRole(snapshot.val().role);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  const value = { currentUser, userRole, login, logout, isAdmin: userRole === 'admin' };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
`);

// src/components/Login.jsx
fs.writeFileSync('src/components/Login.jsx', `import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      setError('Грешен имейл или парола');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width: '350px' }}>
        <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>Caritas Portal</h2>
        {error && <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Имейл"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          <input
            type="password"
            placeholder="Парола"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
            Вход
          </button>
        </form>
      </div>
    </div>
  );
}
`);

// src/components/Dashboard.jsx
fs.writeFileSync('src/components/Dashboard.jsx', `import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase';
import { ref, get, remove } from 'firebase/database';
import Sidebar from './Sidebar';

export default function Dashboard() {
  const { currentUser, isAdmin, logout } = useAuth();
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const requestsRef = ref(database, 'requests');
    const snapshot = await get(requestsRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      if (isAdmin) {
        setRequests(list);
      } else {
        setRequests(list.filter(r => r.createdBy === currentUser.uid || r.assignedTo === currentUser.uid));
      }
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!confirm('Сигурен ли си?')) return;
    await remove(ref(database, \`requests/\${id}\`));
    loadRequests();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '20px', background: '#f5f5f5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Основно табло</h2>
          <button onClick={logout} style={{ padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Изход</button>
        </div>
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
                  <td style={{ padding: '10px' }}>{r.description}</td>
                  <td style={{ padding: '10px' }}>{r.date}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ background: '#17a2b8', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{r.status}</span>
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => handleDelete(r.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Изтрий</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`);

// src/components/Sidebar.jsx
fs.writeFileSync('src/components/Sidebar.jsx', `import { useAuth } from '../contexts/AuthContext';

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
        <div style={{ padding: '10px', marginBottom: '10px', cursor: 'pointer' }}> Export</div>
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
`);

// src/App.jsx
fs.writeFileSync('src/App.jsx', `import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function AppContent() {
  const { currentUser } = useAuth();
  return currentUser ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
`);

// .gitignore
fs.writeFileSync('.gitignore', `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Firebase config
src/firebase-config.js
`);

// README.md
fs.writeFileSync('README.md', `# Caritas Portal

## Инсталация

1. Инсталирай зависимостите:
\`\`\`
npm install
\`\`\`

2. Конфигурирай Firebase в \`src/firebase.js\`

3. Стартирай проекта:
\`\`\`
npm run dev
\`\`\`

## Деплой във Vercel

1. Качи кода в GitHub
2. Свържи с Vercel
3. Deploy!
`);

console.log('✅ Всички файлове са създадени успешно!');
console.log('📦 Сега изпълни: npm install');
console.log('🚀 След това: npm run dev');