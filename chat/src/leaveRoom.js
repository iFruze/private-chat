// leaveRoom.js
import { db, auth } from "./firebase";
import { doc, updateDoc, arrayRemove, getDoc, deleteDoc } from "firebase/firestore";

export async function leaveRoom(roomId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Не авторизован");

  const roomRef = doc(db, "rooms", roomId);
  const userRef = doc(db, "users", user.uid);

  // 1. Удаляем пользователя из members
  await updateDoc(roomRef, {
    members: arrayRemove(user.uid)
  });

  // 2. Удаляем комнату из списка пользователя
  await updateDoc(userRef, {
    rooms: arrayRemove(roomId)
  });

  // 3. Проверяем, остались ли участники
  const snap = await getDoc(roomRef);
  if (snap.exists()) {
    const data = snap.data();
    if (!data.members || data.members.length === 0) {
      // Комната пустая — удаляем
      await deleteDoc(roomRef);
    }
  }
}
