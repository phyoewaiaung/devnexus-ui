// src/components/NavBar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// icons
import {
  Home, LogOut, LogIn, UserPlus, Bell, Search as SearchIcon,
  User, PencilLine, Download
} from "lucide-react";

/* ------------------------------------------------------ */

export default function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // PWA install
  const { canInstall, promptInstall, isStandalone } = useInstallPrompt();

  // simple theme toggle (no next-themes)
  const [isDark, setIsDark] = useState(
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setIsDark(true);
  }, []);

  const isActive = (to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

  // search
  const [query, setQuery] = useState("");
  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const NavLink = ({ to, children, className = "" }) => (
    <Link
      to={to}
      className={
        "px-3 py-2 text-sm font-medium rounded-xl ios-transition " +
        (isActive(to)
          ? "text-foreground bg-accent/60"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/40") +
        (className ? " " + className : "")
      }
      aria-current={isActive(to) ? "page" : undefined}
    >
      {children}
    </Link>
  );

  return (
    <header className="sticky top-0 z-[9999] w-full border-b border-border/70 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 md:h-[60px] md:gap-4 md:px-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/src/assets/transparent.png"
            alt="DevNexus"
            className="h-6 w-auto sm:h-8 object-contain"
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#3C81D2] to-[#8B5CF6] bg-clip-text text-transparent whitespace-nowrap">
            DevNexus
          </h1>
        </Link>

        {/* Desktop links */}
        <div className="ml-2 hidden items-center gap-1 md:flex">
          <NavLink to="/" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span>Feed</span>
          </NavLink>
          {user && (
            <NavLink to={`/u/${user.username}`} className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </NavLink>
          )}
          {user && (
            <NavLink to="/settings/profile" className="flex items-center gap-2">
              <PencilLine className="h-4 w-4" />
              <span>Edit Profile</span>
            </NavLink>
          )}
        </div>

        <div className="flex-1" />

        {/* Search (desktop) */}
        <form onSubmit={onSearch} className="hidden items-center gap-2 md:flex">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search devs, posts, tags…"
              className="w-64 pl-8 rounded-2xl bg-background/70 backdrop-blur-md border border-border/60
                         shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] focus-visible:ring-2 focus-visible:ring-ring ios-transition"
            />
          </div>
        </form>

        {/* Right actions */}
        <div className="ml-1 flex items-center gap-1 md:ml-2 md:gap-2">

          {/* Install: only when not installed and prompt available */}
          {!isStandalone && canInstall && (
            <Button
              variant="secondary"
              size="sm"
              onClick={promptInstall}
              className="hidden md:inline-flex gap-2 rounded-2xl ios-transition hit"
              aria-label="Install DevNexus"
              title="Install DevNexus"
            >
              <Download className="h-4 w-4" />
              Install
            </Button>
          )}

          {/* Real-time notifications bell */}
          {user && <NotiBell />}

          {/* theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDark((v) => !v)}
            aria-label="Toggle theme"
            className="ios-transition hover:scale-[1.05] active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              {isDark ? (
                <path
                  d="M12 18a6 6 0 100-12 6 6 0 000 12zM12 2v2m0 16v2m10-10h-2M4 12H2m15.364 6.364l-1.414-1.414M6.05 6.05 4.636 4.636m12.728 0-1.414 1.414M6.05 17.95l-1.414 1.414"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
                  stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
                />
              )}
            </svg>
          </Button>

          {user ? <UserMenu user={user} onLogout={logout} /> : <AuthButtons />}
        </div>
      </nav>

      {/* compact mobile link row */}
      <div className="md:hidden border-t border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-2">
          <Link
            to="/"
            className={`text-sm px-2 py-1 rounded-xl ios-transition ${location.pathname === "/"
              ? "bg-accent/60 text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
          >
            Feed
          </Link>
          {user && (
            <>
              <Link
                to={`/u/${user.username}`}
                className={`text-sm px-2 py-1 rounded-xl ios-transition ${location.pathname.startsWith("/u/")
                  ? "bg-accent/60 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
              >
                Profile
              </Link>
              <Link
                to="/settings/profile"
                className={`text-sm px-2 py-1 rounded-xl ios-transition ${location.pathname.startsWith("/settings")
                  ? "bg-accent/60 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
              >
                Edit Profile
              </Link>
            </>
          )}

          {/* Mobile "Install" action */}
          {!isStandalone && canInstall && (
            <Button
              variant="outline"
              size="sm"
              onClick={promptInstall}
              className="ml-auto gap-2 rounded-2xl ios-transition hit"
              aria-label="Install DevNexus"
            >
              <Download className="h-4 w-4" />
              Install
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------- Subcomponents ------------------------- */

function AuthButtons() {
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button variant="outline" size="sm" asChild className="rounded-2xl ios-transition hit">
        <Link to="/login"><LogIn className="mr-2 h-4 w-4" /> Login</Link>
      </Button>
      <Button size="sm" asChild className="rounded-2xl ios-transition hit">
        <Link to="/register"><UserPlus className="mr-2 h-4 w-4" /> Register</Link>
      </Button>
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const initials = (user?.name || user?.username || "?").trim().slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 rounded-2xl ios-transition">
          <Avatar className="h-6 w-6">
            {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user?.name || "Avatar"} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="max-w-[120px] truncate text-sm font-medium">{user?.name || user?.username}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl">
        <DropdownMenuLabel>
          <div className="truncate font-semibold">{user?.name || user?.username}</div>
          <div className="truncate text-xs text-muted-foreground">@{user?.username}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to={`/u/${user.username}`}>Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/settings/profile">Edit Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/settings">Settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Real-time Notifications Bell
 * - shows unread badge
 * - lists latest items in a dropdown
 * - marks all as read when the dropdown opens
 *
 * Requires:
 *  - NotificationsProvider wrapping the app
 *  - Server emits: 'notification:new', 'notification:remove' (optional 'notification:count')
 *  - REST endpoints: GET /api/notifications, POST /api/notifications/read
 */
function NotiBell() {
  const { items, unread, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20),
    [items]
  );

  const initials = (s) => (s || "U").slice(0, 2).toUpperCase();

  const openPost = (postId) => {
    if (!postId) return;
    navigate(`/p/${postId}`);
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open && unread > 0) markAllRead(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hidden md:inline-flex ios-transition hover:scale-[1.05] active:scale-[0.98]"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              className="absolute -right-1 -top-1 h-5 min-w-[1.25rem] rounded-full bg-red-600 px-1.5 text-xs font-semibold leading-5 text-white"
              aria-live="polite"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-0">
        <div className="p-3">
          <DropdownMenuLabel className="flex items-center justify-between p-0">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 ? <span className="text-xs text-muted-foreground">{unread} new</span> : null}
          </DropdownMenuLabel>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-auto">
          {sorted.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No notifications yet.</div>
          )}
          {sorted.map((n) => {
            const id = String(n._id || n.id);
            const actor = n.actor || {};
            const postId = n.postId || n.post?._id;
            const when = new Date(n.createdAt).toLocaleString();

            return (
              <DropdownMenuItem
                key={id}
                className={`gap-3 items-start cursor-pointer ${!n.read ? "bg-accent/30" : ""}`}
                onClick={() => openPost(postId)}
              >
                <Avatar className="h-7 w-7">
                  {actor.avatarUrl ? <AvatarImage src={actor.avatarUrl} /> : null}
                  <AvatarFallback>{initials(actor.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-sm leading-tight">
                  <div className="text-foreground">
                    <strong>@{actor.username || "user"}</strong>{" "}
                    {n.type === "like" ? "liked your post" : "commented on your post"}
                  </div>
                  <div className="text-xs text-muted-foreground">{when}</div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
