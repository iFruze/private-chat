import { useState } from "react";
import { sendMessage } from "./sendMessage";
import { useMessages } from "./useMessages";
import { createRoom } from "./createRoom";
import { joinRoom } from "./joinRoom";

function App() {
  const [roomId, setRoomId] = useState(null);
  const [code, setCode] = useState("");

  async function handleCreate() {
    const room = await createRoom();
    setRoomId(room.roomId);
    alert("Код комнаты: " + room.code);
  }

  async function handleJoin() {
    const room = await joinRoom(code);
    setRoomId(room.roomId);
  }

  if (roomId) {
    return <Chat roomId={roomId} />;
  }

  return (
    <div style={{ padding: 20 }}>
      <button onClick={handleCreate}>Создать комнату</button>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="Введите код комнаты"
          value={code}
          onChange={e => setCode(e.target.value)}
        />
        <button onClick={handleJoin}>Войти</button>
      </div>
    </div>
  );
}

function Chat({ roomId }) {
  const [text, setText] = useState("");
  const messages = useMessages(roomId);

  async function handleSend() {
    await sendMessage(roomId, text);
    setText("");
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ height: 300, overflowY: "auto", border: "1px solid #ccc", padding: 10 }}>
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: 10 }}>
            <b>{m.authorId.slice(0, 5)}:</b> {m.text}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
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

export default App;
