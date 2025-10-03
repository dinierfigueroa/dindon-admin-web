// Importa las funciones que necesitas de los SDKs
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// TODO: Reemplaza esto con la configuración de tu proyecto de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDJ3z5RuY_R8ccirDS1UcdEiKOiB9Jy30U",
  authDomain: "dindonexpress1.firebaseapp.com",
  databaseURL: "https://dindonexpress1-default-rtdb.firebaseio.com",
  projectId: "dindonexpress1",
  storageBucket: "dindonexpress1.appspot.com",
  messagingSenderId: "702324555271",
  appId: "1:702324555271:web:9701e51f481d28d8de74a2",
  measurementId: "G-GQPTNB6S16"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta los servicios que usarás en la aplicación
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);