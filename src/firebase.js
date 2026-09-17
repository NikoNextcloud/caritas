// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyZJkgwGCN3AE7kbZuU_VKlAvskT1R4Wk",
  authDomain: "caritas-vitania.firebaseapp.com",
  databaseURL: "https://caritas-vitania-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "caritas-vitania",
  storageBucket: "caritas-vitania.firebasestorage.app",
  messagingSenderId: "984069491074",
  appId: "1:984069491074:web:ebf3bd258539a2e7d8679b",
  measurementId: "G-VPJFE2EXWD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);