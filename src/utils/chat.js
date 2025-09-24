export const nameOf = (u) => u?.name || u?.username || "Unknown";


export const initials = (u) => (nameOf(u).match(/\b\w/g) || [])
    .slice(0, 2)
    .join("")
    .toUpperCase();


export const lastMessagePreview = (m) => {
    if (!m) return "";
    if (typeof m === "string") return m;
    if (typeof m?.text === "string" && m.text.trim()) return m.text;
    return "New message";
};