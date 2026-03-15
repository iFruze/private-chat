// Chat.jsx
import { useState, useRef, useEffect } from "react";
import { sendMessage } from "./sendMessage";
import { useMessages } from "./useMessages";
import { useUsers } from "./useUsers";
import { auth } from "./firebase";
import {
  startCall,
  answerCall,
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
  const [callController, setCallController] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  async function handleSend() {
    if (!isAuth) return;
    await sendMessage(roomId, text);
    setText("");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Подписка на входящие звонки
  useEffect(() => {
    const unsub = watchIncomingCalls(roomId, ({ callId }) => {
      setIncomingCall({ callId });
    });
    return () => unsub();
  }, [roomId]);

  // Привязка стримов к video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log("[UI] attaching remote stream to VIDEO", remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
    } else {
      console.log("[UI] remote video not attached", {
        hasRef: !!remoteVideoRef.current,
        hasStream: !!remoteStream
      });
    }
  }, [remoteStream]);


  useEffect(() => {
    if (!remoteStream) return;

    console.log("[UI] attaching remoteStream to audio");
    const audio = new Audio();
    audio.srcObject = remoteStream;
    audio.autoplay = true;

    const play = async () => {
      try {
        await audio.play();
        console.log("[UI] remote audio playing");
      } catch (e) {
        console.warn("[UI] audio play error", e);
      }
    };

    play();

    return () => {
      audio.pause();
      audio.srcObject = null;
    };
  }, [remoteStream]);

  async function getMedia(audioOnly = false) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: !audioOnly,
    });
    setLocalStream(stream);
    return stream;
  }

  async function handleStartCall(audioOnly = false) {
    if (!isAuth || inCall) return;
    const stream = await getMedia(audioOnly);
    const ctrl = await startCall(roomId, stream, {
      onRemoteStream: (s) => {
        console.log("[UI] onRemoteStream", s);
        console.log("[UI] remote audio tracks:", s.getAudioTracks());
        setRemoteStream(s)
      },
      onEnd: handleEndCall,
    });
    setCallController(ctrl);
    setInCall(true);
  }

  async function handleAnswerCall(audioOnly = false) {
    if (!incomingCall || inCall) return;
    const stream = await getMedia(audioOnly);
    const ctrl = await answerCall(roomId, incomingCall.callId, stream, {
      onRemoteStream: (s) => setRemoteStream(s),
      onEnd: handleEndCall,
    });
    setCallController(ctrl);
    setInCall(true);
    setIncomingCall(null);
  }

  async function handleEndCall() {
    if (callController) {
      await callController.stop();
    }
    setInCall(false);
    setIncomingCall(null);
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallController(null);
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
      year: "numeric"
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

      {incomingCall && !inCall && (
        <div className="incoming-call">
          Входящий звонок
          <button onClick={() => handleAnswerCall(true)}>Принять (аудио)</button>
          <button onClick={() => handleAnswerCall(false)}>Принять (видео)</button>
          <button onClick={handleEndCall}>Отклонить</button>
        </div>
      )}

      {inCall && (
        <div className="call-panel">
          <div className="videos">
            <video ref={localVideoRef} autoPlay muted className="video local" />
            <video ref={remoteVideoRef} autoPlay className="video remote" />
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

          const time = m.createdAt?.toDate().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          });

          // === ГРУППИРОВКА ПО ДАТАМ ===
          const currentDate = m.createdAt;
          const prevDate = index > 0 ? messages[index - 1].createdAt : null;

          const showDate =
            !prevDate ||
            currentDate.toDate().toDateString() !== prevDate.toDate().toDateString();

          return (
            <>
              {showDate && (
                <div key={`date-${m.id}`} className="date-separator">
                  {formatDate(currentDate)}
                </div>
              )}

              <div key={m.id} className={`message ${isMe ? "me" : "other"}`}>
                {!isMe && (
                  <div className="author-name">
                    {user?.name || user?.email?.split("@")[0] || "Без имени"}
                  </div>
                )}

                <div className="message-text">{m.text}</div>
                <div className="message-time">{time}</div>
              </div>
            </>
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
