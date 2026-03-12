import { useState } from "react";
import { createRoom } from "./createRoom";
import { joinRoom } from "./joinRoom";
import { getRooms, saveRoom } from "./roomHistory";
import Chat from "./Chat";
import "./Layout.css";

function App() {
  const [roomId, setRoomId] = useState(null);
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState(getRooms());

  async function handleCreate() {
    const room = await createRoom();
    saveRoom(room.roomId, room.code);
    setRooms(getRooms());
    setRoomId(room.roomId);
  }

  async function handleJoin() {
    const room = await joinRoom(code);
    saveRoom(room.roomId, code);
    setRooms(getRooms());
    setRoomId(room.roomId);
  }

  // 📱 Мобильная версия: если открыт чат — показываем только чат
  if (window.innerWidth < 700 && roomId) {
    return <Chat roomId={roomId} onBack={() => setRoomId(null)} />;
  }

  return (
    <div className="app-container">
      {/* Левая панель */}
      <div className="sidebar">
        <h2>Ваши чаты</h2>

        <input
          placeholder="Введите код комнаты"
          value={code}
          onChange={e => setCode(e.target.value)}
        />
        <button onClick={handleJoin}>Войти</button>

        <button onClick={handleCreate}>Создать комнату</button>

        <div className="room-list">
          {rooms.map(r => (
            <div
              key={r.roomId}
              className="room-item"
              onClick={() => setRoomId(r.roomId)}
            >
              Комната: {r.code}
            </div>
          ))}
        </div>
      </div>

      {/* Правая панель — чат */}
      <div className="chat-wrapper">
        {roomId && <Chat roomId={roomId} />}
      </div>
    </div>
  );
}

export default App;
