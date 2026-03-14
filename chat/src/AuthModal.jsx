import { useState } from "react";
import { login, register } from "./auth";
import "./AuthModal.css";

function translateError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Некорректный email";

    case "auth/missing-password":
      return "Введите пароль";

    case "auth/weak-password":
      return "Пароль должен содержать минимум 6 символов";

    case "auth/email-already-in-use":
      return "Этот email уже зарегистрирован";

    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Неверный email или пароль";

    case "auth/missing-email":
      return "Введите email";

    default:
      return "Произошла ошибка. Попробуйте ещё раз";
  }
}

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
        if (!name.trim()) {
          setError("Введите имя");
          return;
        }
        await register(email, password, name);
      }
      onClose();
    } catch (err) {
      const code = err.code || "";
      setError(translateError(code));
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
