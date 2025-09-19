// src/pages/NotificationsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { listNotifications } from "@/api/notifications";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useNotifications } from "@/providers/NotificationsProvider";

function relativeTime(ts) {
    if (!ts) return "";
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    const diffSec = Math.floor((new Date(ts).getTime() - Date.now()) / 1000);
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
        const v = Math.round(diffSec / sec);
        if (Math.abs(v) >= 1) return rtf.format(v, unit);
    }
    return "just now";
}

export default function NotificationsPage() {
    const { items, unread, markAllRead } = useNotifications();
    const navigate = useNavigate();
    const [refreshing, setRefreshing] = useState(false);

    const sorted = useMemo(
        () => [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        [items]
    );

    const refresh = async () => {
        try {
            setRefreshing(true);
            await listNotifications(50); // provider will pick up socket pushes; this keeps REST in sync
            // no need to set state directly here since provider already did initial fetch; this is a soft refresh
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        // Optionally mark all read on open for mobile UX
        if (unread > 0) markAllRead();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // once

    const openPost = (postId) => {
        if (!postId) return;
        navigate(`/p/${postId}`);
    };

    return (
        <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:py-4">
            {/* Header row */}
            <div className="mb-3 flex items-center justify-between">
                <h1 className="text-xl font-semibold">Notifications</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
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
                    const actor = n.actor || {};
                    const postId = n.postId || n.post?._id;
                    const when = relativeTime(n.createdAt);
                    const initials = (actor.username || "U").slice(0, 2).toUpperCase();

                    // 👇 best-effort cross-version support: pick any available field
                    const commentDesc =
                        n.commentText ||
                        n?.meta?.commentText ||
                        n?.meta?.comment_desc ||
                        n.comment_desc ||
                        "";

                    return (
                        <button
                            key={id}
                            onClick={() => openPost(postId)}
                            className={`w-full rounded-2xl border border-border bg-card px-3 py-2 text-left transition-colors
                    ${!n.read ? "bg-accent/20" : "hover:bg-accent/10"}`}
                        >
                            <div className="flex items-start gap-3">
                                <Avatar className="h-9 w-9">
                                    {actor.avatarUrl ? <AvatarImage src={actor.avatarUrl} /> : null}
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>

                                <div className="flex-1">
                                    <div className="text-sm">
                                        <strong>@{actor.username || "user"}</strong>{" "}
                                        {n.type === "like" ? "liked your post" : "commented on your post"}
                                    </div>

                                    {/* when */}
                                    <div className="mt-0.5 text-xs text-muted-foreground">{when}</div>

                                    {/* 👇 comment snippet (only for comment notifs and if text exists) */}
                                    {n.type === "comment" && commentDesc ? (
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
