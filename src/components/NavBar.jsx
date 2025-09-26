// src/components/NavBar.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { searchSuggest } from "@/api/search";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";

// icons
import {
  Home, LogOut, LogIn, UserPlus, Bell, Search as SearchIcon,
  User, PencilLine, Download, MessageSquare, Settings, Sun, Moon, Plus,
  Hash, Code2, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

// robust asset import (works in dev & prod)
import logoUrl from "@/assets/transparent.png";
import { updateTheme } from "@/api/users";
import { useNotifications } from "@/providers/NotificationsProvider";

/* ------------------------------------------------------ */

export default function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // PWA install
  const { canInstall, promptInstall, isStandalone } = useInstallPrompt();

  /* ----------------------------- THEME ------------------------------ */
  const [theme, setTheme] = useState(() => {
    const ls = safeGetLocalTheme();
    if (ls === "light" || ls === "dark") return ls;
    if (user?.theme === "light" || user?.theme === "dark") return user.theme;
    return "light";
  });

  useEffect(() => {
    applyTheme(theme);
    safeSetLocalTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (user?.theme && user.theme !== theme) setTheme(user.theme);
  }, [user?.theme]); // eslint-disable-line

  const toggleTheme = async (newTheme) => {
    if (newTheme !== "light" && newTheme !== "dark") return;
    setTheme(newTheme);
    if (user) {
      try { await updateTheme(newTheme); } catch { /* ignore */ }
    }
  };

  /* ----------------------------- ACTIVE LINK ------------------------------ */
  const isActive = (to) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  /* ----------------------------- SEARCH ------------------------------ */
  const [query, setQuery] = useState("");
  const [openSug, setOpenSug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sug, setSug] = useState({ users: [], posts: [], languages: [], tags: [] });
  const [highlight, setHighlight] = useState({ section: 0, index: -1 });
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const sections = useMemo(() => ([
    { key: 'users', label: 'Users', icon: User },
    { key: 'posts', label: 'Posts', icon: FileText },
    { key: 'languages', label: 'Languages', icon: Code2 },
    { key: 'tags', label: 'Tags', icon: Hash },
  ]), []);

  const totalItems = useMemo(() => {
    const len = (arr) => Array.isArray(arr) ? arr.length : 0;
    return sections.reduce((acc, s) => acc + len(sug[s.key]), 0);
  }, [sug, sections]);

  const resetHighlight = () => setHighlight({ section: 0, index: -1 });

  // Normalize payload in case fetch layer wraps it later
  function normalizeSuggestPayload(raw) {
    const root = raw?.data || raw?.result || raw || {};
    return {
      users: Array.isArray(root.users) ? root.users : [],
      posts: Array.isArray(root.posts) ? root.posts : [],
      languages: Array.isArray(root.languages) ? root.languages : [],
      tags: Array.isArray(root.tags) ? root.tags : [],
    };
  }

  const fetchSuggest = useCallback(async (q) => {
    const term = (q || "").trim();
    if (term.length < 2) {
      setSug({ users: [], posts: [], languages: [], tags: [] });
      setOpenSug(false);
      return;
    }
    setLoading(true);
    try {
      const raw = await searchSuggest(term);
      console.log(raw)
      const norm = normalizeSuggestPayload(raw);
      setSug(norm);
      setOpenSug(true);
    } catch {
      setSug({ users: [], posts: [], languages: [], tags: [] });
      setOpenSug(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // close suggestions on route change
  useEffect(() => {
    setOpenSug(false);
    setLoading(false);
    setSug({ users: [], posts: [], languages: [], tags: [] });
    resetHighlight();
  }, [location.key]);

  // debounce user input
  useEffect(() => {
    if (!query) {
      setOpenSug(false);
      setSug({ users: [], posts: [], languages: [], tags: [] });
      return;
    }
    const t = setTimeout(() => {
      fetchSuggest(query);
    }, 150);
    return () => clearTimeout(t);
  }, [query, fetchSuggest]);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setOpenSug(false);
  };

  const moveHighlight = (dir) => {
    if (!openSug || totalItems === 0) return;
    let secIdx = highlight.section;
    let idx = highlight.index;
    let cycles = 0;

    const nextNonEmptySection = (start, step) => {
      let s = start;
      for (let i = 0; i < sections.length; i++) {
        s = (s + step + sections.length) % sections.length;
        const list = sug[sections[s].key] || [];
        if (list.length > 0) return s;
      }
      return start;
    };

    while (cycles < sections.length * 2) {
      const list = sug[sections[secIdx].key] || [];
      idx += dir;
      if (idx >= 0 && idx < list.length) {
        setHighlight({ section: secIdx, index: idx });
        return;
      }
      secIdx = nextNonEmptySection(secIdx, dir);
      const nextList = sug[sections[secIdx].key] || [];
      if (nextList.length > 0) {
        setHighlight({ section: secIdx, index: dir > 0 ? 0 : nextList.length - 1 });
        return;
      }
      cycles++;
    }
  };

  const activateHighlighted = () => {
    if (!openSug) return;
    const sec = sections[highlight.section];
    if (!sec) return;
    const list = sug[sec.key] || [];
    const item = list[highlight.index];
    if (!item) return;
    goToSuggestion(sec.key, item);
  };

  const goToSuggestion = (type, item) => {
    setOpenSug(false);
    if (type === 'users') {
      navigate(`/u/${item.username}`);
      return;
    }
    if (type === 'posts') {
      navigate(`/p/${item._id}`);
      return;
    }
    if (type === 'languages') {
      navigate(`/?lang=${encodeURIComponent(item)}`);
      return;
    }
    if (type === 'tags') {
      navigate(`/?tag=${encodeURIComponent(item)}`);
      return;
    }
  };

  useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current) return;
      if (boxRef.current.contains(e.target) || inputRef.current?.contains(e.target)) return;
      setOpenSug(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const NavLink = ({ to, children, className = "", badge = null }) => (
    <Link
      to={to}
      className={cn(
        "relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200",
        "hover:scale-[1.02] active:scale-[0.98]",
        isActive(to)
          ? "text-primary bg-primary/10 shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
        className
      )}
      aria-current={isActive(to) ? "page" : undefined}
    >
      {children}
      {badge && badge > 0 && (
        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-[20px] text-xs px-1.5 animate-pulse">
          {badge > 99 ? "99+" : badge}
        </Badge>
      )}
    </Link>
  );

  return (
    <header className="sticky top-0 z-[9999] w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-6">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-3 shrink-0 hover:scale-105 transition-transform duration-200"
        >
          <div className="relative">
            <img
              src={logoUrl}
              alt="DevNexus"
              className="h-8 w-8 object-contain"
            />
            <div className="absolute -inset-1 bg-gradient-to-r from-[#3C81D2] to-[#8B5CF6] rounded-full opacity-20 blur-sm"></div>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#3C81D2] to-[#8B5CF6] bg-clip-text text-transparent">
              DevNexus
            </h1>
            <div className="text-xs text-muted-foreground -mt-1">Developer Community</div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-2 ml-4">
          <NavLink to="/">
            <Home className="h-4 w-4" />
            <span>Feed</span>
          </NavLink>

          {user && (
            <>
              <NavLink to="/chats" badge={null}>
                <MessageSquare className="h-4 w-4" />
                <span>Chats</span>
              </NavLink>

              <NavLink to={`/u/${user.username}`}>
                <User className="h-4 w-4" />
                <span>Profile</span>
              </NavLink>
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="hidden md:flex items-center relative" ref={boxRef}>
          <form onSubmit={onSearchSubmit} className="items-center relative">
            <div className="relative group">
              <SearchIcon
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                  loading ? "text-primary animate-spin" : "text-muted-foreground group-focus-within:text-primary"
                )}
              />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); resetHighlight(); }}
                onFocus={() => { if (query.trim().length >= 2) setOpenSug(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); moveHighlight(+1); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); moveHighlight(-1); }
                  else if (e.key === 'Enter') {
                    if (openSug && highlight.index >= 0) {
                      e.preventDefault();
                      activateHighlighted();
                    }
                  } else if (e.key === 'Escape') {
                    setOpenSug(false);
                  }
                }}
                placeholder="Search users, posts, languages, tags..."
                className={cn(
                  "w-80 pl-10 pr-8 h-10 rounded-full border-border/60 bg-background/50",
                  "focus:w-[28rem] transition-all duration-300 focus:shadow-lg focus:shadow-primary/20",
                  "placeholder:text-muted-foreground/70"
                )}
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { setQuery(""); setOpenSug(false); resetHighlight(); }}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-accent/50"
                >
                  ×
                </Button>
              )}
            </div>
          </form>

          {/* Suggestions dropdown */}
          {openSug && (
            <Card className="absolute top-[110%] right-0 w-[28rem] rounded-xl border-border/60 bg-popover/95 backdrop-blur-xl shadow-xl p-2">
              {loading && totalItems === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Searching…</div>
              ) : totalItems === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No matches</div>
              ) : (
                sections.map((sec, sIdx) => {
                  const arr = sug[sec.key] || [];
                  if (!arr.length) return null;
                  const Icon = sec.icon;
                  return (
                    <div key={sec.key} className="py-1">
                      <div className="px-2 pb-1 text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {sec.label}
                      </div>
                      <ul className="max-h-56 overflow-y-auto">
                        {arr.map((item, i) => {
                          const active = (highlight.section === sIdx && highlight.index === i);
                          return (
                            <li
                              key={item._id || item.username || item}
                              className={cn(
                                "flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer",
                                active ? "bg-accent text-foreground" : "hover:bg-accent/60"
                              )}
                              onMouseEnter={() => setHighlight({ section: sIdx, index: i })}
                              onMouseDown={(e) => { e.preventDefault(); }} // keep focus
                              onClick={() => goToSuggestion(sec.key, item)}
                            >
                              {sec.key === 'users' && (
                                <>
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={item.avatarUrl} />
                                    <AvatarFallback>{(item.username || item.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium leading-5">@{item.username}</div>
                                    {item.name && <div className="text-xs text-muted-foreground">{item.name}</div>}
                                  </div>
                                </>
                              )}
                              {sec.key === 'posts' && (
                                <>
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-sm line-clamp-1">{item.preview || (item.text || '').slice(0, 80)}</div>
                                    <div className="text-xs text-muted-foreground">
                                      by @{item.author?.username || 'user'} • {new Date(item.createdAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                </>
                              )}
                              {sec.key === 'languages' && (
                                <>
                                  <Code2 className="h-4 w-4 shrink-0" />
                                  <div className="text-sm">{item}</div>
                                </>
                              )}
                              {sec.key === 'tags' && (
                                <>
                                  <Hash className="h-4 w-4 shrink-0" />
                                  <div className="text-sm">{item}</div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}
              <div className="px-2 pt-1 pb-2 text-[11px] text-muted-foreground">
                Press <kbd className="px-1 py-0.5 rounded bg-muted">↑</kbd>/<kbd className="px-1 py-0.5 rounded bg-muted">↓</kbd> to navigate, <kbd className="px-1 py-0.5 rounded bg-muted">Enter</kbd> to open.
              </div>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Create Post */}
          {user && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden md:flex items-center gap-2 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Link to="/create">
                <Plus className="h-4 w-4" />
                <span>Create</span>
              </Link>
            </Button>
          )}

          {/* Install PWA */}
          {!isStandalone && canInstall && (
            <Button
              variant="ghost"
              size="icon"
              onClick={promptInstall}
              className="hidden lg:flex rounded-full hover:bg-accent/50 transition-colors"
              title="Install DevNexus App"
              aria-label="Install DevNexus App"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}

          {/* Notifications */}
          {user && <EnhancedNotiBell />}

          {/* Theme Toggle */}
          <ThemeToggle theme={theme} onThemeChange={toggleTheme} />

          {/* User Menu or Auth */}
          {user ? <EnhancedUserMenu user={user} onLogout={logout} /> : <AuthButtons />}
        </div>
      </nav>
    </header>
  );
}

/* ------------------------- Enhanced Components ------------------------- */

function AuthButtons() {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="rounded-full hover:bg-accent/50 transition-colors"
      >
        <Link to="/login">
          <LogIn className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Login</span>
        </Link>
      </Button>
      <Button
        size="sm"
        asChild
        className="rounded-full bg-gradient-to-r from-[#3C81D2] to-[#8B5CF6] hover:shadow-lg transition-all"
      >
        <Link to="/register">
          <UserPlus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Join</span>
        </Link>
      </Button>
    </div>
  );
}

function ThemeToggle({ theme, onThemeChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-accent/50 transition-colors"
          aria-label="Change theme"
        >
          {theme === "dark" && <Moon className="h-4 w-4" />}
          {theme === "light" && <Sun className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl z-[9999]">
        <DropdownMenuItem onClick={() => onThemeChange("light")} className="gap-2">
          <Sun className="h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onThemeChange("dark")} className="gap-2">
          <Moon className="h-4 w-4" />
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EnhancedUserMenu({ user, onLogout }) {
  const initials = (user?.name || user?.username || "?").trim().slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-primary/20 transition-all"
          aria-label="User menu"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.avatarUrl} alt={user?.name || "Avatar"} />
            <AvatarFallback className="bg-gradient-to-br from-[#3C81D2] to-[#8B5CF6] text-white text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl border-border/60 bg-card/95 backdrop-blur-xl z-[9999]">
        <DropdownMenuLabel className="pb-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.avatarUrl} />
              <AvatarFallback className="bg-gradient-to-br from-[#3C81D2] to-[#8B5CF6] text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{user?.name || user?.username}</div>
              <div className="text-xs text-muted-foreground truncate">@{user?.username}</div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="gap-3">
          <Link to={`/u/${user.username}`}>
            <User className="h-4 w-4" />
            View Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="gap-3">
          <Link to="/settings/profile">
            <PencilLine className="h-4 w-4" />
            Edit Profile
          </Link>
        </DropdownMenuItem>

        {/* <DropdownMenuItem asChild className="gap-3">
          <Link to="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem> */}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onLogout}
          className="gap-3 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ----------------------- Notifications (updated) ---------------------- */

function EnhancedNotiBell() {
  const { items, unread, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const sorted = useMemo(
    () =>
      [...items]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10),
    [items]
  );

  const handleOpen = (n) => {
    const postId = n.postId || n.post?._id || n.post || null;
    const convoId = n.conversationId || n.conversation?._id || n.conversation || null;

    if (n.type?.startsWith('chat:') && convoId) {
      navigate(`/chats/${convoId}`);
      return;
    }
    if ((n.type === 'like' || n.type === 'comment') && postId) {
      navigate(`/p/${postId}`);
      return;
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open && unread > 0) markAllRead(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full hover:bg-accent/50 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] text-xs px-1.5 animate-pulse"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-xl border-border/60 bg-card/95 backdrop-blur-xl p-0">
        <div className="p-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unread > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unread} new
              </Badge>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">No notifications yet</div>
            </div>
          ) : (
            sorted.map((notification) => (
              <NotificationItem
                key={notification._id || notification.id}
                notification={notification}
                onOpen={() => handleOpen(notification)}
              />
            ))
          )}
        </div>

        {sorted.length > 0 && (
          <div className="p-3 border-t border-border/60">
            <Button variant="ghost" size="sm" asChild className="w-full rounded-full">
              <Link to="/noti">View All Notifications</Link>
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({ notification, onOpen }) {
  const actor = notification.actor || {};
  const initials = (actor.username || actor.name || "U").slice(0, 2).toUpperCase();

  const whenStr = (() => {
    try { return new Date(notification.createdAt).toLocaleString(); }
    catch { return ""; }
  })();

  const t = notification.type;
  const kind = notification.meta?.kind;
  const title = notification.meta?.title;
  const preview = notification.meta?.preview;

  let actionText = "";
  if (t === "like") actionText = "liked your post";
  else if (t === "comment") actionText = "commented on your post";
  else if (t === "chat:invite") actionText = `invited you to join${title ? ` “${title}”` : ""}`;
  else if (t === "chat:accept") actionText = `accepted your invite${title ? ` to “${title}”` : ""}`;
  else if (t === "chat:decline") actionText = `declined your invite${title ? ` to “${title}”` : ""}`;
  else if (t === "chat:message") actionText = (kind === "group" && title) ? `messaged in “${title}”` : "sent you a message";
  else actionText = "sent a notification";

  return (
    <DropdownMenuItem
      className={cn(
        "flex items-start gap-3 p-4 cursor-pointer border-l-2 transition-colors",
        !notification.read ? "border-l-primary bg-primary/5" : "border-l-transparent"
      )}
      onClick={onOpen}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={actor.avatarUrl} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-tight">
          <span className="font-medium">@{actor.username || "user"}</span>{" "}
          <span className="text-muted-foreground">{actionText}</span>
        </p>
        {t === "chat:message" && preview && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{whenStr}</p>
      </div>
    </DropdownMenuItem>
  );
}

/* ----------------------------- THEME HELPERS ------------------------------ */

function applyTheme(mode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
}
function safeGetLocalTheme() {
  try { return localStorage.getItem("theme"); } catch { return null; }
}
function safeSetLocalTheme(t) {
  try { localStorage.setItem("theme", t); } catch { /* ignore */ }
}
