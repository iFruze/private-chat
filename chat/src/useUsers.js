// useUsers.js
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

export function useUsers(roomId) {
  const [users, setUsers] = useState({});

  useEffect(() => {
    if (!roomId) return;

    const roomRef = doc(db, "rooms", roomId);

    const unsub = onSnapshot(roomRef, async (snap) => {
      const data = snap.data();
      if (!data?.members) {
        setUsers({});
        return;
      }

      const members = data.members;
      const map = {};

      await Promise.all(
        members.map(async (uid) => {
          const uSnap = await getDoc(doc(db, "users", uid));
          if (uSnap.exists()) {
            map[uid] = uSnap.data();
          }
        })
      );

      setUsers(map);
    });

    return () => unsub();
  }, [roomId]);

  return users;
}
