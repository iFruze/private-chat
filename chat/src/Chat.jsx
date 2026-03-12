import { useState, useRef, useEffect } from "react";
import { sendMessage } from "./sendMessage";
import { useMessages } from "./useMessages";
import { auth } from "./firebase";
import "./Chat.css";

function Chat({ roomId, onBack }) {
  const [text, setText] = useState("");
  const messages = useMessages(roomId);
  const myId = auth.currentUser.uid;
  const bottomRef = useRef(null);

  async function handleSend() {
    await sendMessage(roomId, text);
    setText("");
  }

  // Авто‑скролл вниз
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-container">
      {/* Кнопка назад для телефона */}
      {onBack && (
        <button
          style={{
            padding: 10,
            background: "#4a90e2",
            color: "white",
            border: "none",
            width: "100%",
          }}
          onClick={onBack}
        >
          ← Назад к списку чатов
        </button>
      )}

      <div className="messages">
        {messages.map(m => (
          <div
            key={m.id}
            className={`message ${m.authorId === myId ? "me" : "other"}`}
          >
            {m.text}
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      <div className="input-area">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Введите сообщение"
        />
        <button onClick={handleSend}>Отправить</button>
      </div>
    </div>
  );
}

export default Chat;
