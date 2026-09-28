// Inicialización de Firebase (SDK v8 compat, cargado como <script> clásico en index.html
// antes de este módulo — por eso `firebase` existe como global). Se mantiene exactamente
// el mismo proyecto/base de datos que la app original para no perder los datos ya guardados.
const firebaseConfig = {
    apiKey: "AIzaSyD86xvnjFFHkdMhvHPOkYUn8_PdHgNOEK0",
    authDomain: "misuperappfinanciera.firebaseapp.com",
    databaseURL: "https://misuperappfinanciera-default-rtdb.firebaseio.com",
    projectId: "misuperappfinanciera",
    storageBucket: "misuperappfinanciera.firebasestorage.app",
    messagingSenderId: "320368053330",
    appId: "1:320368053330:web:c85ec9a1108be81617a38b"
};

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
const db = firebase.database();

export function userRef(uid, path = '') {
    return db.ref(`Usuarios/${uid}${path ? '/' + path : ''}`);
}
