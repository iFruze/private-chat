import { useState } from "react";
import { login, register } from "./auth";
import "./AuthModal.css";

export default function AuthModal({ onClose }) {
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
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <h2>{mode === "login" ? "Вход" : "Регистрация"}</h2>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <input
              placeholder="Имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            placeholder="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit">
            {mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <button
          className="auth-switch"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Нет аккаунта? Регистрация"
            : "Уже есть аккаунт? Войти"}
        </button>

        <button className="auth-close" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
