// App.jsx
import { useEffect, useState } from "react";
import { watchAuth } from "./auth";
import { auth } from "./firebase";
import AuthModal from "./AuthModal";
import { createRoom } from "./createRoom";
import { joinRoom } from "./joinRoom";
import Chat from "./Chat";
import "./Layout.css";

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const [roomId, setRoomId] = useState(null);
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState([]);

  const [showAuth, setShowAuth] = useState(false);

  // Следим за авторизацией
  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  // Загружаем комнаты пользователя
  useEffect(() => {
    async function loadRooms() {
      if (!user) {
        setRooms([]);
        return;
      }

      const { db } = await import("./firebase");
      const { doc, getDoc } = await import("firebase/firestore");

      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setRooms(data.rooms || []);
      }
    }

    loadRooms();
  }, [user]);

  // Создание комнаты
  async function handleCreate() {
    const room = await createRoom();
    setRoomId(room.roomId);

    setRooms((prev) =>
      prev.includes(room.roomId) ? prev : [...prev, room.roomId]
    );

    alert("Код комнаты: " + room.code);
  }

  // Вход в комнату по коду
  async function handleJoin() {
    const room = await joinRoom(code);
    setRoomId(room.roomId);

    setRooms((prev) =>
      prev.includes(room.roomId) ? prev : [...prev, room.roomId]
    );
  }

  // Выход из комнаты
  function handleExit() {
    setRoomId(null);
  }

  // Выход из аккаунта
  function handleLogout() {
    auth.signOut();
    setRoomId(null);
  }

  if (!ready) return null;

  const isMobile = window.innerWidth < 700;

  // Мобильная версия: если открыт чат — показываем только чат
  if (isMobile && roomId) {
    return (
      <Chat
        roomId={roomId}
        onBack={() => setRoomId(null)}
        onExit={handleExit}
      />
    );
  }

  return (
    <>
      {/* Модальное окно авторизации */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <div className="app-container">
        {/* Левая панель */}
        <div className="sidebar">

          {/* Профиль */}
          <div className="profile-block">
            {!user ? (
              <button className="profile-btn" onClick={() => setShowAuth(true)}>
                Войти
              </button>
            ) : (
              <div className="profile-info">
                <div className="profile-email">{user.email}</div>
                <button className="logout-btn" onClick={handleLogout}>
                  Выйти
                </button>
              </div>
            )}
          </div>

          <h2>Ваши чаты</h2>

          <input
            placeholder="Введите код комнаты"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button onClick={handleJoin}>Войти</button>

          <button onClick={handleCreate}>Создать комнату</button>

          <div className="room-list">
            {rooms.map((id) => (
              <div
                key={id}
                className="room-item"
                onClick={() => setRoomId(id)}
              >
                Комната: {id.slice(0, 6)}...
              </div>
            ))}
          </div>
        </div>

        {/* Правая панель — чат */}
        <div className="chat-wrapper">
          {roomId && (
            <Chat
              roomId={roomId}
              onExit={handleExit}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default App;
