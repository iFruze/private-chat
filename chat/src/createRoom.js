// createRoom.js
import { db, auth } from "./firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom() {
  const user = auth.currentUser;
  if (!user) throw new Error("Не авторизован");

  const code = generateCode();

  const roomRef = await addDoc(collection(db, "rooms"), {
    ownerUid: user.uid,
    members: [user.uid],
    code,
    createdAt: new Date(),
  });

  // можно дополнительно привязать комнату к пользователю
  await updateDoc(doc(db, "users", user.uid), {
    rooms: (await import("firebase/firestore")).arrayUnion(roomRef.id),
  });

  return { roomId: roomRef.id, code };
}
