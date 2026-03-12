import {initializeApp} from "firebase/app"
import {getFirestore} from "firebase/firestore"
import {getAuth} from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyBuaOgrAfsu-mWk-hpd1QsIVayxsGpLAHM",
  authDomain: "private-chat-a5424.firebaseapp.com",
  projectId: "private-chat-a5424",
  storageBucket: "private-chat-a5424.firebasestorage.app",
  messagingSenderId: "488267240883",
  appId: "1:488267240883:web:9250b373aebe4e9ebfa7c6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);