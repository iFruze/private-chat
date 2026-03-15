// callService.js
import { db } from "./firebase";
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import { auth } from "./firebase";

const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

export function createPeerConnection({ onRemoteStream, onEnd }) {
  const pc = new RTCPeerConnection({ iceServers });

  pc.ontrack = (event) => {
    console.log("[RTC] REMOTE TRACK RECEIVED");
    const [stream] = event.streams;
    onRemoteStream && onRemoteStream(stream);
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[RTC] ICE STATE:", pc.iceConnectionState);
    if (
      pc.iceConnectionState === "failed" ||
      pc.iceConnectionState === "disconnected" ||
      pc.iceConnectionState === "closed"
    ) {
      onEnd && onEnd();
    }
  };

  return pc;
}

// Удаляем старые звонки в комнате (делает только инициатор)
async function clearOldCalls(roomId) {
  const callsCol = collection(db, "rooms", roomId, "calls");
  const snaps = await getDocs(callsCol);
  snaps.forEach((d) => deleteDoc(d.ref));
}

// Инициатор
export async function startCall(roomId, localStream, { onRemoteStream, onEnd }) {
  if (!auth.currentUser) throw new Error("Not authenticated");

  await clearOldCalls(roomId);

  const callsCol = collection(db, "rooms", roomId, "calls");
  const callRef = await addDoc(callsCol, {
    status: "calling",
    from: auth.currentUser.uid,
    createdAt: Date.now()
  });

  const callerCandidates = collection(callRef, "callerCandidates");
  const calleeCandidates = collection(callRef, "calleeCandidates");

  const pc = createPeerConnection({ onRemoteStream, onEnd });

  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      console.log("[RTC] caller ICE");
      await addDoc(callerCandidates, { candidate: event.candidate.toJSON() });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await updateDoc(callRef, { offer });

  // Буфер для ICE от собеседника, если они придут раньше answer
  const pendingRemoteCandidates = [];

  const unsubCall = onSnapshot(callRef, async (snap) => {
    const data = snap.data();
    if (!data) return;

    if (data.answer && !pc.currentRemoteDescription) {
      console.log("[RTC] ANSWER RECEIVED");
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

      // После установки remoteDescription — добавляем отложенные кандидаты
      for (const c of pendingRemoteCandidates) {
        try {
          await pc.addIceCandidate(c);
        } catch (e) {
          console.warn("[RTC] error adding buffered ICE", e);
        }
      }
      pendingRemoteCandidates.length = 0;
    }

    if (data.status === "ended") {
      console.log("[RTC] call ended (by remote)");
      onEnd && onEnd();
      unsubCall();
    }
  });

  const unsubCandidates = onSnapshot(calleeCandidates, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidateData = change.doc.data().candidate;
        const candidate = new RTCIceCandidate(candidateData);
        console.log("[RTC] callee ICE -> received");

        if (pc.remoteDescription) {
          pc.addIceCandidate(candidate).catch((e) =>
            console.warn("[RTC] error adding ICE", e)
          );
        } else {
          // remoteDescription ещё нет — складываем в буфер
          pendingRemoteCandidates.push(candidate);
        }
      }
    });
  });

  return {
    callId: callRef.id,
    pc,
    stop: async () => {
      console.log("[RTC] stop() by caller");
      await updateDoc(callRef, { status: "ended" });
      pc.close();
      unsubCall();
      unsubCandidates();
    }
  };
}

// Ответчик
export async function answerCall(roomId, callId, localStream, { onRemoteStream, onEnd }) {
  if (!auth.currentUser) throw new Error("Not authenticated");

  const callRef = doc(db, "rooms", roomId, "calls", callId);
  const callSnap = await getDoc(callRef);
  if (!callSnap.exists()) throw new Error("Call not found");

  const data = callSnap.data();

  const pc = createPeerConnection({ onRemoteStream, onEnd });

  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  const callerCandidates = collection(callRef, "callerCandidates");
  const calleeCandidates = collection(callRef, "calleeCandidates");

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      console.log("[RTC] callee ICE");
      await addDoc(calleeCandidates, { candidate: event.candidate.toJSON() });
    }
  };

  // У ответчика порядок правильный: сначала remoteDescription, потом ICE
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await updateDoc(callRef, { answer, status: "in-progress" });

  const unsubCall = onSnapshot(callRef, (snap) => {
    const d = snap.data();
    if (!d) return;
    if (d.status === "ended") {
      console.log("[RTC] call ended (by remote)");
      onEnd && onEnd();
      unsubCall();
    }
  });

  const unsubCandidates = onSnapshot(callerCandidates, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidateData = change.doc.data().candidate;
        const candidate = new RTCIceCandidate(candidateData);
        console.log("[RTC] caller ICE -> add");
        pc.addIceCandidate(candidate).catch((e) =>
          console.warn("[RTC] error adding ICE", e)
        );
      }
    });
  });

  return {
    pc,
    stop: async () => {
      console.log("[RTC] stop() by callee");
      await updateDoc(callRef, { status: "ended" });
      pc.close();
      unsubCall();
      unsubCandidates();
    }
  };
}

// Входящие звонки
export function watchIncomingCalls(roomId, cb) {
  const callsCol = collection(db, "rooms", roomId, "calls");
  return onSnapshot(callsCol, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type !== "added") return;

      const data = change.doc.data();

      // Игнорируем свои же звонки
      if (data.from && data.from === auth.currentUser?.uid) return;

      if (data.status === "calling") {
        console.log("[RTC] incoming call");
        cb({ callId: change.doc.id, data });
      }
    });
  });
}
