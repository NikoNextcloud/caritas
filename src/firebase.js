import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAyZJkgwGCN3AE7kbZuU_VklAvskT1R4Wk",
  authDomain: "caritas-vitania.firebaseapp.com",
  databaseURL: "https://caritas-vitania-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "caritas-vitania",
  storageBucket: "caritas-vitania.firebasestorage.app",
  messagingSenderId: "984069491074",
  appId: "1:984069491074:web:ebf3bd258539a2e7d8679b",
  measurementId: "G-VPJFE2EXWD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);