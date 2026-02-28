const firebase = require('firebase/compat/app');
require('firebase/compat/database');
firebase.initializeApp({
  databaseURL: "https://sinavsistemi-c58fe-default-rtdb.firebaseio.com"
});
const db = firebase.database();
db.ref('/').once('value').then(snap => {
  const data = snap.val();
  console.log("Root keys:", Object.keys(data || {}));
  process.exit(0);
});
