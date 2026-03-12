// App.jsx
import { useEffect, useState } from "react";
import { watchAuth, login, register } from "./auth";
import { createRoom } from "./createRoom";
import { joinRoom } from "./joinRoom";
import Chat from "./Chat";
import "./Layout.css";

function AuthForm({ onReady }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      onReady();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>{mode === "login" ? "Вход" : "Регистрация"}</h2>

      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <input
            placeholder="Имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: "block", marginBottom: 8 }}
          />
        )}

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", marginBottom: 8 }}
        />

        <input
          placeholder="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", marginBottom: 8 }}
        />

        {error && <div style={{ color: "red" }}>{error}</div>}

        <button type="submit">
          {mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>

      <button
        style={{ marginTop: 10 }}
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login"
          ? "Нет аккаунта? Регистрация"
          : "Уже есть аккаунт? Войти"}
      </button>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const [roomId, setRoomId] = useState(null);
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState([]);

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

  async function handleCreate() {
    const room = await createRoom();
    setRoomId(room.roomId);

    setRooms((prev) =>
      prev.includes(room.roomId) ? prev : [...prev, room.roomId]
    );

    alert("Код комнаты: " + room.code);
  }

  async function handleJoin() {
    const room = await joinRoom(code);
    setRoomId(room.roomId);

    setRooms((prev) =>
      prev.includes(room.roomId) ? prev : [...prev, room.roomId]
    );
  }

  function handleExit() {
    setRoomId(null);
  }

  if (!ready) return null;

  // Если не авторизован — показываем форму
  if (!user) {
    return <AuthForm onReady={() => {}} />;
  }

  // Мобильная версия: если открыт чат — показываем только чат
  if (window.innerWidth < 700 && roomId) {
    return (
      <Chat
        roomId={roomId}
        onBack={() => setRoomId(null)}
        onExit={handleExit}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Левая панель */}
      <div className="sidebar">
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
  );
}

export default App;
