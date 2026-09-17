import { createContext, useContext, useState, useEffect } from 'react';
import { auth, database } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';

console.log('Firebase auth initialized:', auth);
console.log('Firebase database initialized:', database);

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
      console.log('Auth state changed:', user);
      setCurrentUser(user);
      if (user) {
        try {
          const userRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userRef);
          console.log('User data from database:', snapshot.val());
          if (snapshot.exists()) {
            setUserRole(snapshot.val().role);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    console.log('Attempting login with email:', email);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', result.user);
      return result;
    } catch (error) {
      console.error('Login failed:', error.code, error.message);
      throw error;
    }
  };
  
  const logout = () => signOut(auth);

  const value = { currentUser, userRole, login, logout, isAdmin: userRole === 'admin' };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
