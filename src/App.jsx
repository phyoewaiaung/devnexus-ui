import { Routes, Route, Outlet, Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// pages
import FeedPage from "./pages/FeedPage";
import ProfilePage from "./pages/ProfilePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import EditProfilePage from "./pages/EditProfilePage";

// layout
import NavBar from "./components/NavBar";
import PrivateRoute from "./components/PrivateRoute";

// shadcn/ui
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// icons
import { Home, TrendingUp, Plus, User as UserIcon, Bell } from "lucide-react";
import { useNotifications } from "@/context/NotificationsContext";
import { Toaster } from "sonner";
import NotificationsPage from "./pages/NotificationsPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<MainAppShell />}>
          {/* Feed */}
          <Route element={<FeedShell />}>
            <Route path="/" element={<FeedPage />} />
          </Route>

          {/* Other pages */}
          <Route element={<PageShell />}>
            <Route path="/u/:username" element={<ProfilePage />} />
            <Route path="/noti" element={<NotificationsPage />} />
            <Route element={<PrivateRoute />}>
              <Route path="/settings/profile" element={<EditProfilePage />} />
            </Route>
          </Route>

          {/* Auth */}
          <Route element={<AuthShell />}>
            <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
            <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}

/* --------------------------- FEED SHELL --------------------------- */
function FeedShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NavBar />
      <main className="flex-1 container mx-auto max-w-2xl px-3 md:px-4 py-4 md:py-6 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-6">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}

/* --------------------------- PAGE SHELL --------------------------- */
function PageShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NavBar />
      <main className="flex-1 container mx-auto max-w-2xl px-3 md:px-4 py-4 md:py-6 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-6">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}

/* --------------------------- APP SHELL --------------------------- */
function MainAppShell() {
  return (
    <div className="relative w-full">
      <Outlet />
    </div>
  );
}

/* --------------------------- AUTH SHELL --------------------------- */
function AuthShell() {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex items-center justify-center p-12 bg-[oklch(1_0_0)] dark:bg-[oklch(0.16_0.03_265)] relative">
        <div className="absolute inset-6 rounded-3xl bg-background/50 backdrop-blur-2xl" />
        <div className="relative max-w-md text-center">
          <img src="/src/assets/transparent.png" alt="DevNexus" className="w-[20vw] h-[10vw] object-contain mx-auto" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-[#3C81D2] to-[#8B5CF6] bg-clip-text text-transparent mb-2">
            DevNexus
          </h1>
          <p className="text-muted-foreground">
            The developer community platform for sharing code, ideas, and opportunities.
          </p>
        </div>
      </div>

      {/* Auth outlet */}
      <div id="auth-outlet" className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/* --------------------------- MOBILE BOTTOM NAV (iOS-style) --------------------------- */
function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const { unread } = useNotifications(); // ← get unread count

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/trends", icon: TrendingUp, label: "Trends" },
    { to: "/post", icon: Plus, label: "Post" },
    { to: "/noti", icon: Bell, label: "Noti" }, // route you already use
    { to: user ? `/u/${user.username}` : "/login", icon: UserIcon, label: "Profile" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden">
      <div className="mx-auto max-w-md px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <div className="grid grid-cols-5 h-16 rounded-2xl border border-border/60 bg-background/70 backdrop-blur-xl shadow-[0_6px_20px_rgba(0,0,0,0.10)]">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active =
              location.pathname === to ||
              (label === "Profile" && location.pathname.startsWith("/u/")) ||
              (label === "Noti" && location.pathname.startsWith("/noti"));

            // accessible label for Notifications item
            const ariaLabel =
              label === "Noti" && unread > 0
                ? `Notifications, ${unread > 99 ? "99 plus" : unread} unread`
                : label;

            return (
              <Link
                key={label}
                to={to}
                aria-current={active ? "page" : undefined}
                aria-label={ariaLabel}
                className={`relative flex flex-col items-center justify-center gap-1 text-[11px] ios-transition hit
                  ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}
                `}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-[1.06]" : ""}`} />

                {/* label */}
                <span className="leading-none">{label}</span>

                {/* unread badge only for Noti */}
                {label === "Noti" && unread > 0 && (
                  <span
                    className="absolute right-4 top-1 h-4 min-w-[1rem] rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white"
                    aria-live="polite"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* --------------------------- MISC --------------------------- */
function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NavBar />
      <div className="flex flex-1 items-center justify-center">
        <Card className="p-10 text-center bg-card/80 backdrop-blur-xl text-card-foreground border border-border/60 shadow-[0_10px_30px_rgba(0,0,0,0.10)] rounded-2xl">
          <div className="mb-2 text-lg font-semibold">Page not found</div>
          <p className="mb-4 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
          <Button asChild className="rounded-2xl hit">
            <Link to="/">Go home</Link>
          </Button>
        </Card>
      </div>
      <MobileBottomNav />
    </div>
  );
}

function RedirectIfAuthed({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}
