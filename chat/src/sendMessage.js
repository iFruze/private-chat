import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function sendMessage(roomId, text) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  if (!text.trim()) return;

  await addDoc(collection(db, "rooms", roomId, "messages"), {
    authorId: user.uid,
    text,
    createdAt: serverTimestamp()
  });
}
