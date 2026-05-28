import { SPORT_API_KEY, GEMINI_API_KEY, FIREBASE_KEY } from '../app/keys/keys';

export const environment = {
  production: false, // o true en el de producción

  apiBaseUrl: '', 
  apiKey: SPORT_API_KEY,
  geminiApiKey: GEMINI_API_KEY,

  firebaseConfig: {
    apiKey: FIREBASE_KEY,
    authDomain: "goalstatspro.firebaseapp.com",
    projectId: "goalstatspro",
    storageBucket: "goalstatspro.firebasestorage.app",
    messagingSenderId: "434574194758",
    appId: "1:434574194758:web:250f9568b858979d8c3247",
    measurementId: "G-7BSXW3NRW8"
  }
};