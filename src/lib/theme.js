const THEME_KEY = 'theme';
export function getTheme() {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem(THEME_KEY) || 'light';
}
export function setTheme(mode) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_KEY, mode);
    const root = document.documentElement;
    if (mode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
}
export function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
}