// callService.js
import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";

const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

export function createPeerConnection({ onRemoteStream, onEnd }) {
  const pc = new RTCPeerConnection({ iceServers });

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    onRemoteStream && onRemoteStream(stream);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
      onEnd && onEnd();
    }
  };

  return pc;
}

// Инициатор звонка
export async function startCall(roomId, localStream, { onRemoteStream, onEnd }) {
  const callsCol = collection(db, "rooms", roomId, "calls");
  const callRef = await addDoc(callsCol, { status: "calling" });
  const candidatesRef = collection(callRef, "callerCandidates");

  const pc = createPeerConnection({ onRemoteStream, onEnd });

  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await addDoc(candidatesRef, { candidate: event.candidate.toJSON() });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await updateDoc(callRef, { offer });

  const unsubCall = onSnapshot(callRef, async (snap) => {
    const data = snap.data();
    if (!data) return;

    if (data.answer && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.status === "ended") {
      onEnd && onEnd();
      unsubCall();
    }
  });

  const calleeCandidatesRef = collection(callRef, "calleeCandidates");
  const unsubCandidates = onSnapshot(calleeCandidatesRef, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data().candidate);
        pc.addIceCandidate(candidate);
      }
    });
  });

  return {
    callId: callRef.id,
    pc,
    stop: async () => {
      await updateDoc(callRef, { status: "ended" });
      pc.close();
      unsubCall();
      unsubCandidates();
    },
  };
}

// Ответчик
export async function answerCall(roomId, callId, localStream, { onRemoteStream, onEnd }) {
  const callRef = doc(db, "rooms", roomId, "calls", callId);
  const callSnap = await getDoc(callRef);
  if (!callSnap.exists()) throw new Error("Звонок не найден");

  const data = callSnap.data();

  const pc = createPeerConnection({ onRemoteStream, onEnd });

  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  const callerCandidatesRef = collection(callRef, "callerCandidates");
  const calleeCandidatesRef = collection(callRef, "calleeCandidates");

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await addDoc(calleeCandidatesRef, { candidate: event.candidate.toJSON() });
    }
  };

  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await updateDoc(callRef, { answer, status: "in-progress" });

  const unsubCall = onSnapshot(callRef, (snap) => {
    const d = snap.data();
    if (!d) return;
    if (d.status === "ended") {
      onEnd && onEnd();
      unsubCall();
    }
  });

  const unsubCandidates = onSnapshot(callerCandidatesRef, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data().candidate);
        pc.addIceCandidate(candidate);
      }
    });
  });

  return {
    pc,
    stop: async () => {
      await updateDoc(callRef, { status: "ended" });
      pc.close();
      unsubCall();
      unsubCandidates();
    },
  };
}

// Подписка на входящие звонки
export function watchIncomingCalls(roomId, cb) {
  const callsCol = collection(db, "rooms", roomId, "calls");
  return onSnapshot(callsCol, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        if (data.status === "calling") {
          cb({ callId: change.doc.id, data });
        }
      }
    });
  });
}
