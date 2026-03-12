// joinRoom.js
import { db, auth } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { arrayUnion } from "firebase/firestore";

export async function joinRoom(code) {
  const user = auth.currentUser;
  if (!user) throw new Error("Не авторизован");

  const q = query(
    collection(db, "rooms"),
    where("code", "==", code.toUpperCase())
  );

  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Комната не найдена");

  const roomDoc = snap.docs[0];
  const roomId = roomDoc.id;
  const data = roomDoc.data();

  // добавляем пользователя в members, если его там нет
  if (!data.members?.includes(user.uid)) {
    await updateDoc(doc(db, "rooms", roomId), {
      members: arrayUnion(user.uid),
    });
  }

  // добавляем комнату в список пользователя
  await updateDoc(doc(db, "users", user.uid), {
    rooms: arrayUnion(roomId),
  });

  return { roomId };
}
