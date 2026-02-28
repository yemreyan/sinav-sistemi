const firebase = require('firebase/compat/app');
require('firebase/compat/database');

const firebaseConfig = {
    apiKey: "AIzaSyARmGt0uPHJH2pejTSQywBVT2VUhV0chVg",
    authDomain: "sinavsistemi-c58fe.firebaseapp.com",
    databaseURL: "https://sinavsistemi-c58fe-default-rtdb.firebaseio.com",
    projectId: "sinavsistemi-c58fe",
    storageBucket: "sinavsistemi-c58fe.firebasestorage.app",
    messagingSenderId: "313707099476",
    appId: "1:313707099476:web:490e18de881799f62b84c1",
    measurementId: "G-PYWHMLXYFW"
};

try {
    firebase.initializeApp(firebaseConfig);
    console.log('[FIREBASE] Web SDK initialized successfully.');
} catch (e) {
    if (!/already exists/.test(e.message)) {
        console.error('Firebase initialization error', e.stack);
    }
}

const db = firebase.database();

module.exports = { admin: firebase, db };
