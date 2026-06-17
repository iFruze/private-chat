// Chat.jsx
import { useState, useRef, useEffect } from "react";
import { sendMessage } from "./sendMessage";
import { useMessages } from "./useMessages";
import { useUsers } from "./useUsers";
import { auth } from "./firebase";
import { Fragment } from "react";
import {
  startCall,
  answerCall,
  rejectCall,
  watchIncomingCalls,
} from "./callService";
import "./Chat.css";

function Chat({ roomId, onBack, onExit }) {
  const [text, setText] = useState("");
  const messages = useMessages(roomId);
  const users = useUsers(roomId);
  const isAuth = !!auth.currentUser;
  const myId = auth.currentUser?.uid;
  const bottomRef = useRef(null);

  const [incomingCall, setIncomingCall] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const callControllerRef = useRef(null);
  const [callAudioOnly, setCallAudioOnly] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const endingCallRef = useRef(false);

  async function handleSend() {
    if (!isAuth) return;
    await sendMessage(roomId, text);
    setText("");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unsub = watchIncomingCalls(roomId, (event) => {
      if (event.type === "incoming" && !inCall) {
        setIncomingCall({
          callId: event.callId,
          audioOnly: event.audioOnly,
        });
      } else if (event.type === "cleared") {
        setIncomingCall((prev) =>
          prev?.callId === event.callId ? null : prev
        );
      }
    });
    return () => unsub();
  }, [roomId, inCall]);

  useEffect(() => {
    if (!localVideoRef.current || !localStream) return;
    localVideoRef.current.srcObject = localStream;
  }, [localStream, inCall]);

  useEffect(() => {
    if (!remoteStream) return;

    if (callAudioOnly && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((e) => {
        console.warn("[UI] remote audio play error", e);
      });
      return;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, inCall, callAudioOnly]);

  async function getMedia(audioOnly = false) {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: !audioOnly,
      });
      setLocalStream(stream);
      return stream;
    } catch (e) {
      console.error("[UI] getUserMedia error", e);
      const message =
        e.name === "NotAllowedError"
          ? "Нет доступа к камере или микрофону. Разрешите доступ в настройках браузера."
          : "Не удалось получить доступ к камере или микрофону.";
      setMediaError(message);
      throw e;
    }
  }

  async function handleStartCall(audioOnly = false) {
    if (!isAuth || inCall) return;
    try {
      const stream = await getMedia(audioOnly);
      setCallAudioOnly(audioOnly);
      const ctrl = await startCall(roomId, stream, {
        audioOnly,
        onRemoteStream: (s) => {
          console.log("[UI] onRemoteStream", s);
          setRemoteStream(s);
        },
        onEnd: handleEndCall,
      });
      callControllerRef.current = ctrl;
      setInCall(true);
    } catch {
      // getUserMedia or startCall error — UI message already set if applicable
    }
  }

  async function handleAnswerCall() {
    if (!incomingCall || inCall) return;
    const audioOnly = incomingCall.audioOnly;
    try {
      const stream = await getMedia(audioOnly);
      setCallAudioOnly(audioOnly);
      const ctrl = await answerCall(roomId, incomingCall.callId, stream, {
        onRemoteStream: (s) => setRemoteStream(s),
        onEnd: handleEndCall,
      });
      callControllerRef.current = ctrl;
      setInCall(true);
      setIncomingCall(null);
    } catch {
      // error handled in getMedia
    }
  }

  async function handleRejectCall() {
    if (incomingCall) {
      try {
        await rejectCall(roomId, incomingCall.callId);
      } catch (e) {
        console.warn("[UI] reject call error", e);
      }
    }
    setIncomingCall(null);
  }

  async function handleEndCall() {
    if (endingCallRef.current) return;
    endingCallRef.current = true;

    const controller = callControllerRef.current;
    callControllerRef.current = null;

    if (controller) {
      await controller.stop();
    }
    setInCall(false);
    setIncomingCall(null);
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallAudioOnly(false);
    endingCallRef.current = false;
  }

  function formatDate(date) {
    const d = date.toDate();
    const today = new Date();

    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (isToday) return "Сегодня";

    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>
            ←
          </button>
        )}
        <div className="chat-title">Комната</div>
        <div className="chat-actions">
          <button
            className="call-btn"
            disabled={!isAuth || inCall}
            onClick={() => handleStartCall(true)}
          >
            🔊
          </button>
          <button
            className="call-btn"
            disabled={!isAuth || inCall}
            onClick={() => handleStartCall(false)}
          >
            🎥
          </button>
          {onExit && (
            <button className="exit-btn" onClick={onExit}>
              Выйти
            </button>
          )}
        </div>
      </div>

      {mediaError && (
        <div className="media-error">{mediaError}</div>
      )}

      {incomingCall && !inCall && (
        <div className="incoming-call">
          Входящий {incomingCall.audioOnly ? "аудио" : "видео"}-звонок
          <button onClick={handleAnswerCall}>Принять</button>
          <button onClick={handleRejectCall}>Отклонить</button>
        </div>
      )}

      {inCall && (
        <div className="call-panel">
          <div className="videos">
            {!callAudioOnly && (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="video local"
              />
            )}
            {callAudioOnly ? (
              <audio ref={remoteAudioRef} autoPlay playsInline />
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="video remote"
              />
            )}
          </div>
          <button className="hangup-btn" onClick={handleEndCall}>
            Завершить звонок
          </button>
        </div>
      )}

      <div className="messages">
        {messages.map((m, index) => {
          const isMe = m.authorId === myId;
          const user = users[m.authorId];

          const time = m.createdAt
            ? m.createdAt.toDate().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          const currentDate = m.createdAt ?? null;
          const prevDate = index > 0 ? messages[index - 1].createdAt ?? null : null;

          const currentDateString = currentDate
            ? currentDate.toDate().toDateString()
            : null;

          const prevDateString = prevDate
            ? prevDate.toDate().toDateString()
            : null;

          const showDate =
            currentDateString &&
            (!prevDateString || currentDateString !== prevDateString);

          return (
            <Fragment key={m.id}>
              {showDate && (
                <div className="date-separator">
                  {formatDate(currentDate)}
                </div>
              )}

              <div className={`message ${isMe ? "me" : "other"}`}>
                {!isMe && (
                  <div className="author-name">
                    {user?.name || user?.email?.split("@")[0] || "Без имени"}
                  </div>
                )}

                <div className="message-text">{m.text}</div>
                <div className="message-time">{time}</div>
              </div>
            </Fragment>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите сообщение"
          disabled={!isAuth}
        />
        <button onClick={handleSend} disabled={!isAuth}>
          Отправить
        </button>
      </div>
    </div>
  );
}

export default Chat;
