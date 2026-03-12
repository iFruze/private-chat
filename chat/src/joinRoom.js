import { db, auth } from "./firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { hashCode } from "./utils";

export async function joinRoom(code) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const codeHash = await hashCode(code);

  // Ищем комнату по хэшу
  const q = query(collection(db, "rooms"), where("codeHash", "==", codeHash));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error("Комната не найдена");
  }

  const roomDoc = snapshot.docs[0];
  const roomId = roomDoc.id;
  const roomData = roomDoc.data();

  // Проверяем, есть ли уже этот пользователь
  if (!roomData.allowedUsers.includes(user.uid)) {
    if (roomData.allowedUsers.length >= 2) {
      throw new Error("Комната уже заполнена");
    }

    // Добавляем пользователя
    await updateDoc(doc(db, "rooms", roomId), {
      allowedUsers: [...roomData.allowedUsers, user.uid]
    });
  }

  return { roomId };
}
