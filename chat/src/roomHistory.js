export function saveRoom(roomId, code) {
  const list = JSON.parse(localStorage.getItem("rooms") || "[]");

  if (!list.find(r => r.roomId === roomId)) {
    list.push({ roomId, code });
    localStorage.setItem("rooms", JSON.stringify(list));
  }
}

export function getRooms() {
  return JSON.parse(localStorage.getItem("rooms") || "[]");
}
