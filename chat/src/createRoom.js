import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "./firebase";

import { generateRoomCode, hashCode } from "./utils"; // создадим utils позже

export async function createRoom() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const code = generateRoomCode();
  const codeHash = await hashCode(code);

  const docRef = await addDoc(collection(db, "rooms"), {
    codeHash,
    allowedUsers: [user.uid],
    createdAt: serverTimestamp()
  });

  return { roomId: docRef.id, code };
}
