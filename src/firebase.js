// Conexión del navegador con Firebase. Estos datos son públicos: la seguridad
// la dan las reglas de Firestore (firestore.rules) y el backend.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC2iHZ4Bikyxypm-W-637Ha3ohzx8L63u0',
  authDomain: 'el-sol-tucumano-981aa.firebaseapp.com',
  projectId: 'el-sol-tucumano-981aa',
  storageBucket: 'el-sol-tucumano-981aa.firebasestorage.app',
  messagingSenderId: '459419470534',
  appId: '1:459419470534:web:3fd0a11a4ef21fb0ffe5c7',
  measurementId: 'G-H2FJQE0FWX',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
