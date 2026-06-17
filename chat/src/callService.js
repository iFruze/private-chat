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
  deleteDoc,
} from "firebase/firestore";
import { auth } from "./firebase";

const DISCONNECTED_GRACE_MS = 10_000;
const INCOMING_CALL_MAX_AGE_MS = 60_000;
const STALE_CALL_AGE_MS = 5 * 60_000;

function getIceServers() {
  const custom = import.meta.env.VITE_ICE_SERVERS;
  if (custom) {
    try {
      return JSON.parse(custom);
    } catch (e) {
      console.warn("[RTC] invalid VITE_ICE_SERVERS JSON", e);
    }
  }

  const servers = [{ urls: "stun:stun.l.google.com:19302" }];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
    });
  }

  return servers;
}

async function deleteCollection(colRef) {
  const snaps = await getDocs(colRef);
  await Promise.all(snaps.docs.map((d) => deleteDoc(d.ref)));
}

async function cleanupCallDoc(callRef) {
  await deleteCollection(collection(callRef, "callerCandidates"));
  await deleteCollection(collection(callRef, "calleeCandidates"));
  await deleteDoc(callRef);
}

async function cleanupStaleCalls(roomId) {
  const callsCol = collection(db, "rooms", roomId, "calls");
  const snaps = await getDocs(callsCol);
  const now = Date.now();

  await Promise.all(
    snaps.docs.map(async (d) => {
      const data = d.data();
      const age = now - (data.createdAt || 0);
      const isTerminal = data.status === "ended" || data.status === "rejected";
      const isStale =
        age > STALE_CALL_AGE_MS ||
        (data.status === "calling" && age > INCOMING_CALL_MAX_AGE_MS);

      if (isTerminal || isStale) {
        await cleanupCallDoc(d.ref);
      }
    })
  );
}

export function createPeerConnection({ onRemoteStream, onEnd }) {
  const pc = new RTCPeerConnection({ iceServers: getIceServers() });
  let disconnectTimer = null;
  let intentionalClose = false;

  const clearDisconnectTimer = () => {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
  };

  pc.ontrack = (event) => {
    console.log("[RTC] REMOTE TRACK RECEIVED");
    const [stream] = event.streams;
    onRemoteStream && onRemoteStream(stream);
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    console.log("[RTC] ICE STATE:", state);

    if (state === "connected" || state === "completed") {
      clearDisconnectTimer();
      return;
    }

    if (state === "disconnected") {
      if (!disconnectTimer) {
        disconnectTimer = setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") {
            console.log("[RTC] disconnected grace period expired");
            onEnd && onEnd();
          }
        }, DISCONNECTED_GRACE_MS);
      }
      return;
    }

    if (state === "failed" || state === "closed") {
      clearDisconnectTimer();
      if (!intentionalClose) {
        onEnd && onEnd();
      }
    }
  };

  const originalClose = pc.close.bind(pc);
  pc.close = () => {
    intentionalClose = true;
    clearDisconnectTimer();
    originalClose();
  };

  return pc;
}

export async function startCall(
  roomId,
  localStream,
  { onRemoteStream, onEnd, audioOnly = false }
) {
  if (!auth.currentUser) throw new Error("Not authenticated");

  await cleanupStaleCalls(roomId);

  const callsCol = collection(db, "rooms", roomId, "calls");
  const callRef = await addDoc(callsCol, {
    status: "calling",
    from: auth.currentUser.uid,
    createdAt: Date.now(),
    audioOnly: !!audioOnly,
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

  const pendingRemoteCandidates = [];
  let remoteDescriptionSet = false;

  const unsubCall = onSnapshot(callRef, async (snap) => {
    const data = snap.data();
    if (!data) return;

    if (data.answer && !remoteDescriptionSet) {
      remoteDescriptionSet = true;
      console.log("[RTC] ANSWER RECEIVED");
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

      for (const c of pendingRemoteCandidates) {
        try {
          await pc.addIceCandidate(c);
        } catch (e) {
          console.warn("[RTC] error adding buffered ICE", e);
        }
      }
      pendingRemoteCandidates.length = 0;
    }

    if (data.status === "ended" || data.status === "rejected") {
      console.log("[RTC] call ended (by remote):", data.status);
      unsubCall();
      unsubCandidates();
      onEnd && onEnd();
    }
  });

  const unsubCandidates = onSnapshot(calleeCandidates, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidateData = change.doc.data().candidate;
        const candidate = new RTCIceCandidate(candidateData);
        console.log("[RTC] callee ICE -> received");

        if (remoteDescriptionSet) {
          pc.addIceCandidate(candidate).catch((e) =>
            console.warn("[RTC] error adding ICE", e)
          );
        } else {
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
      try {
        await updateDoc(callRef, { status: "ended" });
      } catch (e) {
        console.warn("[RTC] failed to update call status", e);
      }
      pc.close();
      unsubCall();
      unsubCandidates();
      cleanupCallDoc(callRef).catch((e) =>
        console.warn("[RTC] cleanup failed", e)
      );
    },
  };
}

export async function answerCall(
  roomId,
  callId,
  localStream,
  { onRemoteStream, onEnd }
) {
  if (!auth.currentUser) throw new Error("Not authenticated");

  const callRef = doc(db, "rooms", roomId, "calls", callId);
  const callSnap = await getDoc(callRef);
  if (!callSnap.exists()) throw new Error("Call not found");

  const data = callSnap.data();
  if (!data.offer) throw new Error("Call offer not ready");
  if (data.status !== "calling") throw new Error("Call is no longer active");

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

  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

  const existingCallerCandidates = await getDocs(callerCandidates);
  for (const d of existingCallerCandidates.docs) {
    const candidate = new RTCIceCandidate(d.data().candidate);
    try {
      await pc.addIceCandidate(candidate);
    } catch (e) {
      console.warn("[RTC] error adding existing caller ICE", e);
    }
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await updateDoc(callRef, { answer, status: "in-progress" });

  const unsubCall = onSnapshot(callRef, (snap) => {
    const d = snap.data();
    if (!d) return;
    if (d.status === "ended" || d.status === "rejected") {
      console.log("[RTC] call ended (by remote):", d.status);
      unsubCall();
      unsubCandidates();
      onEnd && onEnd();
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
      try {
        await updateDoc(callRef, { status: "ended" });
      } catch (e) {
        console.warn("[RTC] failed to update call status", e);
      }
      pc.close();
      unsubCall();
      unsubCandidates();
      cleanupCallDoc(callRef).catch((e) =>
        console.warn("[RTC] cleanup failed", e)
      );
    },
  };
}

export async function rejectCall(roomId, callId) {
  const callRef = doc(db, "rooms", roomId, "calls", callId);
  const snap = await getDoc(callRef);
  if (!snap.exists()) return;

  await updateDoc(callRef, { status: "rejected" });
  await cleanupCallDoc(callRef);
}

export function watchIncomingCalls(roomId, cb) {
  const callsCol = collection(db, "rooms", roomId, "calls");
  const activeIncoming = new Set();

  return onSnapshot(callsCol, (snap) => {
    snap.docChanges().forEach((change) => {
      const data = change.doc.data();
      const callId = change.doc.id;

      if (data.from && data.from === auth.currentUser?.uid) return;

      const age = Date.now() - (data.createdAt || 0);
      const isActiveIncoming =
        data.status === "calling" && age < INCOMING_CALL_MAX_AGE_MS;

      if (change.type === "removed") {
        activeIncoming.delete(callId);
        cb({ callId, type: "cleared" });
        return;
      }

      if (isActiveIncoming) {
        if (!activeIncoming.has(callId)) {
          activeIncoming.add(callId);
          console.log("[RTC] incoming call");
          cb({
            callId,
            type: "incoming",
            audioOnly: !!data.audioOnly,
          });
        }
        return;
      }

      if (
        activeIncoming.has(callId) ||
        data.status === "ended" ||
        data.status === "rejected" ||
        (data.status === "calling" && age >= INCOMING_CALL_MAX_AGE_MS)
      ) {
        activeIncoming.delete(callId);
        cb({ callId, type: "cleared" });
      }
    });
  });
}
