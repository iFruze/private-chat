// Chat.jsx
import { useState, useRef, useEffect } from "react";
import { sendMessage } from "./sendMessage";
import { useMessages } from "./useMessages";
import { useUsers } from "./useUsers";
import { auth } from "./firebase";
import "./Chat.css";

function Chat({ roomId, onBack, onExit }) {
  const [text, setText] = useState("");
  const messages = useMessages(roomId);
  const users = useUsers(roomId);
  const myId = auth.currentUser.uid;
  const bottomRef = useRef(null);

  async function handleSend() {
    await sendMessage(roomId, text);
    setText("");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="chat-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>
            ←
          </button>
        )}
        <div className="chat-title">Комната</div>
        {onExit && (
          <button className="exit-btn" onClick={onExit}>
            Выйти
          </button>
        )}
      </div>

      <div className="messages">
        {messages.map((m) => {
          const isMe = m.authorId === myId;
          const user = users[m.authorId];
          return (
            <div
              key={m.id}
              className={`message ${isMe ? "me" : "other"}`}
            >
              {!isMe && (
                <div className="author-name">
                  {user?.name || "Пользователь"}
                </div>
              )}
              {m.text}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите сообщение"
        />
        <button onClick={handleSend}>Отправить</button>
      </div>
    </div>
  );
}

export default Chat;
