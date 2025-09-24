import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2, Bell, MessageSquare, UserPlus, Check, X } from "lucide-react";
import { useNotifications } from "@/providers/NotificationsProvider";
import { cn } from "@/lib/utils";

/* ------------------ helpers ------------------ */
function relativeTime(ts) {
    if (!ts) return "";
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    const diffSec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000); // past => positive
    const units = [
        ["year", 60 * 60 * 24 * 365],
        ["month", 60 * 60 * 24 * 30],
        ["week", 60 * 60 * 24 * 7],
        ["day", 60 * 60 * 24],
        ["hour", 60 * 60],
        ["minute", 60],
        ["second", 1],
    ];
    for (const [unit, sec] of units) {
        const v = Math.floor(diffSec / sec);
        if (Math.abs(v) >= 1) return rtf.format(-v, unit); // negative => "ago"
    }
    return "just now";
}

function safeActor(actor) {
    return actor || {};
}

function pickPostId(n) {
    return n.postId || n.post?._id || n.post || null;
}

function pickConvoId(n) {
    return n.conversationId || n.conversation?._id || n.conversation || null;
}

function notifIcon(type) {
    if (type === "like" || type === "comment") return <Bell className="h-4 w-4" />;
    if (type === "chat:invite") return <UserPlus className="h-4 w-4" />;
    if (type === "chat:accept") return <Check className="h-4 w-4" />;
    if (type === "chat:decline") return <X className="h-4 w-4" />;
    if (type === "chat:message") return <MessageSquare className="h-4 w-4" />;
    return <Bell className="h-4 w-4" />;
}

/* ------------------ page ------------------ */
export default function NotificationsPage() {
    const { items, unread, markAllRead, refresh } = useNotifications();
    const navigate = useNavigate();
    const [refreshing, setRefreshing] = useState(false);

    const sorted = useMemo(
        () => [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
        [items]
    );

    const doRefresh = async () => {
        try {
            setRefreshing(true);
            await refresh?.(); // let the provider fetch + merge
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (unread > 0) markAllRead();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // on mount

    const openTarget = (n) => {
        const t = n.type || "";
        const convoId = pickConvoId(n);
        const postId = pickPostId(n);

        if (t.startsWith("chat:") && convoId) {
            navigate(`/chats/${convoId}`);
            return;
        }
        if ((t === "like" || t === "comment") && postId) {
            navigate(`/p/${postId}`);
            return;
        }
        // fallback: go to feed
        navigate("/");
    };

    return (
        <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:py-4">
            {/* Header row */}
            <div className="mb-3 flex items-center justify-between">
                <h1 className="text-xl font-semibold">Notifications</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={doRefresh} disabled={refreshing}>
                        {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Refresh
                    </Button>
                    {unread > 0 && (
                        <Button size="sm" onClick={markAllRead}>
                            Mark all read
                        </Button>
                    )}
                </div>
            </div>

            <Separator className="mb-3" />

            {/* Empty state */}
            {sorted.length === 0 && (
                <Card className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">No notifications yet.</p>
                    <div className="mt-3">
                        <Link to="/" className="text-primary hover:underline">Go to feed</Link>
                    </div>
                </Card>
            )}

            {/* List */}
            <div className="space-y-2">
                {sorted.map((n) => {
                    const id = String(n._id || n.id);
                    const actor = safeActor(n.actor);
                    const when = relativeTime(n.createdAt);
                    const aInitials = (actor.username || actor.name || "U").slice(0, 2).toUpperCase();

                    const type = n.type || "";
                    const kind = n.meta?.kind;     // 'dm' | 'group'
                    const title = n.meta?.title;   // group title if any
                    const preview = n.meta?.preview;

                    let line;
                    if (type === "like") {
                        line = <>liked your post</>;
                    } else if (type === "comment") {
                        line = <>commented on your post</>;
                    } else if (type === "chat:invite") {
                        line = <>invited you to join{title ? <> “{title}”</> : null}</>;
                    } else if (type === "chat:accept") {
                        line = <>accepted your invite{title ? <> to “{title}”</> : null}</>;
                    } else if (type === "chat:decline") {
                        line = <>declined your invite{title ? <> to “{title}”</> : null}</>;
                    } else if (type === "chat:message") {
                        if (kind === "group" && title) line = <>messaged in “{title}”</>;
                        else line = <>sent you a message</>;
                    } else {
                        line = <>sent you a notification</>;
                    }

                    // Optional comment snippet for comment notifs (support multiple payload shapes)
                    const commentDesc =
                        n.commentText ||
                        n?.meta?.commentText ||
                        n?.meta?.comment_desc ||
                        n.comment_desc ||
                        "";

                    return (
                        <button
                            key={id}
                            onClick={() => openTarget(n)}
                            className={cn(
                                "w-full rounded-2xl border border-border bg-card px-3 py-2 text-left transition-colors",
                                !n.read ? "bg-accent/20" : "hover:bg-accent/10"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <Avatar className="h-9 w-9 shrink-0">
                                    {actor.avatarUrl ? <AvatarImage src={actor.avatarUrl} /> : null}
                                    <AvatarFallback>{aInitials}</AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                        <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5">
                                            {notifIcon(type)} <span className="capitalize">{type.replace("chat:", "")}</span>
                                        </span>
                                        <span>•</span>
                                        <span>{when}</span>
                                    </div>

                                    <div className="text-sm leading-tight">
                                        <strong>@{actor.username || "user"}</strong>{" "}
                                        <span className="text-muted-foreground">{line}</span>
                                    </div>

                                    {type === "chat:message" && preview ? (
                                        <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground/90 line-clamp-3">
                                            {preview}
                                        </div>
                                    ) : null}

                                    {type === "comment" && commentDesc ? (
                                        <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground/90 line-clamp-3">
                                            {commentDesc}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
