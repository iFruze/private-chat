import { useEffect, useState } from "react";
import { login } from "./auth";
import { createRoom } from "./createRoom";
import { joinRoom } from "./joinRoom";

function App() {
  const [code, setCode] = useState("");

  useEffect(() => {
    login();
  }, []);

  async function handleCreate() {
    const room = await createRoom();
    alert("Комната создана! Код: " + room.code);
  }

  async function handleJoin() {
    try {
      const room = await joinRoom(code);
      alert("Вы вошли в комнату: " + room.roomId);
    } catch (e) {
      alert(e.message);
    }
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

export default App;
