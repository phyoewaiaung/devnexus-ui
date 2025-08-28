// src/lib/theme.js
const THEME_KEY = 'theme';
const RESOLVED_EVENT = 'theme:resolved';

function dispatchResolved(mode) {
    if (typeof window === 'undefined') return;
    const resolved = mode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : mode;
    window.dispatchEvent(new CustomEvent(RESOLVED_EVENT, { detail: resolved }));
}

export function getTheme() {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem(THEME_KEY) || 'system';
}

export function getResolvedTheme() {
    if (typeof window === 'undefined') return 'light';
    const current = getTheme();
    if (current === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return current;
}

export function applyTheme(mode) {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    if (mode === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
    } else {
        root.classList.toggle('dark', mode === 'dark');
    }

    // let listeners (like NavBar) know what’s now applied
    dispatchResolved(mode);
}

export function setTheme(mode) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_KEY, mode);
    applyTheme(mode);
}

export function toggleTheme() {
    const current = getTheme();
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    setTheme(next);
    return next;
}

export function initializeTheme() {
    if (typeof window === 'undefined') return;

    // Apply once at startup
    const saved = getTheme();
    applyTheme(saved);

    // React to OS changes while in "system"
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (getTheme() === 'system') {
            applyTheme('system'); // re-resolve and emit
        }
    };

    // modern API
    mq.addEventListener?.('change', handleChange);
    // fallback (older Safari)
    if (!mq.addEventListener) mq.addListener(handleChange);

    // cleanup
    return () => {
        mq.removeEventListener?.('change', handleChange);
        if (!mq.removeEventListener) mq.removeListener?.(handleChange);
    };
}
