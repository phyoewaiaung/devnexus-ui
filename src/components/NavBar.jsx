import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// icons
import {
  Home, LogOut, LogIn, UserPlus, Bell, Search as SearchIcon,
  User, PencilLine, Download, MessageSquare, Settings, Sun, Moon, Plus
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
      try { await updateTheme(newTheme); } catch { }
    }
  };

  /* ----------------------------- ACTIVE LINK ------------------------------ */
  const isActive = (to) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  /* ----------------------------- SEARCH ------------------------------ */
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || searchLoading) return;
    setSearchLoading(true);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  useEffect(() => {
    if (searchLoading) setSearchLoading(false);
  }, [location.key, searchLoading]);

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
        <form onSubmit={onSearch} className="hidden md:flex items-center relative">
          <div className="relative group">
            <SearchIcon
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                searchLoading ? "text-primary animate-spin" : "text-muted-foreground group-focus-within:text-primary"
              )}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search developers, posts, topics..."
              disabled={searchLoading}
              className={cn(
                "w-80 pl-10 pr-8 h-10 rounded-full border-border/60 bg-background/50",
                "focus:w-96 transition-all duration-300 focus:shadow-lg focus:shadow-primary/20",
                "placeholder:text-muted-foreground/70"
              )}
            />
            {query && !searchLoading && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-accent/50"
              >
                ×
              </Button>
            )}
          </div>
        </form>

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

        <DropdownMenuItem asChild className="gap-3">
          <Link to="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>

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
    // Shapes we might receive
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
  const kind = notification.meta?.kind;  // 'dm' | 'group'
  const title = notification.meta?.title; // group title
  const preview = notification.meta?.preview;

  let actionText = "";
  if (t === "like") {
    actionText = "liked your post";
  } else if (t === "comment") {
    actionText = "commented on your post";
  } else if (t === "chat:invite") {
    actionText = `invited you to join${title ? ` “${title}”` : ""}`;
  } else if (t === "chat:accept") {
    actionText = `accepted your invite${title ? ` to “${title}”` : ""}`;
  } else if (t === "chat:decline") {
    actionText = `declined your invite${title ? ` to “${title}”` : ""}`;
  } else if (t === "chat:message") {
    if (kind === "group" && title) {
      actionText = `messaged in “${title}”`;
    } else {
      actionText = "sent you a message";
    }
  } else {
    actionText = "sent a notification";
  }

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
  try { localStorage.setItem("theme", t); } catch { }
}
