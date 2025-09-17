import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Paperclip, Send, Check, CheckCheck } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChatsAPI } from "@/api/chart";

/* ----------------------------- helpers ----------------------------- */

const presenceValueToBool = (val) => {
    if (!val) return false;
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.toLowerCase() === "online";
    if (typeof val === "number") return Boolean(val);
    if (typeof val === "object") {
        if ("online" in val) return !!val.online;
        if ("status" in val) return String(val.status).toLowerCase() === "online";
    }
    return false;
};

const getPresence = (presence, userId) => {
    if (!presence || !userId) return false;
    const k1 = String(userId);
    let v;
    if (presence?.get) {
        v = presence.get(k1);
        if (v === undefined) v = presence.get(userId);
    } else {
        v = presence[k1] ?? presence[userId];
    }
    return presenceValueToBool(v);
};

const fmtTime = (d) => {
    if (!d) return "";
    try {
        return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
};

const isSameDay = (a, b) => {
    if (!a || !b) return false;
    try {
        const da = new Date(a), db = new Date(b);
        return (
            da.getFullYear() === db.getFullYear() &&
            da.getMonth() === db.getMonth() &&
            da.getDate() === db.getDate()
        );
    } catch {
        return false;
    }
};

const within5Min = (a, b) => {
    if (!a || !b) return false;
    try {
        return Math.abs(new Date(a) - new Date(b)) <= 5 * 60 * 1000;
    } catch {
        return false;
    }
};

// tiny debounce
const debounce = (fn, ms) => {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
};

/* -------------------------- ConversationPage -------------------------- */

export default function ConversationPage() {
    const { id } = useParams();
    const { user: me } = useAuth();
    const { messages, loadHistory, send, indicateTyping, markRead, typing, presence } = useChat();

    const [conv, setConv] = useState(null);
    const [text, setText] = useState("");

    const listRef = useRef(null);
    const inputRef = useRef(null);
    const bottomRef = useRef(null);
    const userAtBottomRef = useRef(true);

    // Load conversation + history
    useEffect(() => {
        if (!id) return;
        let mounted = true;
        (async () => {
            try {
                const c = await ChatsAPI.getConversation(id);
                if (mounted) setConv(c);
            } catch (e) {
                console.error("Failed to load conversation:", e);
            }
            loadHistory(id);
            markRead(id);
        })();
        return () => {
            mounted = false;
        };
    }, [id, loadHistory, markRead]);

    // Watch scroll position to avoid yanking user while reading
    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        const onScroll = () => {
            const threshold = 120;
            userAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    // Auto-scroll when new messages arrive IF user is near bottom or it's my send
    const thread = messages.get(id) || [];
    const lastMsgRef = useRef(null);
    useEffect(() => {
        const last = thread[thread.length - 1];
        const fromMe =
            last &&
            String((last.sender && (last.sender._id || last.sender)) || "") === String(me?._id);
        if (userAtBottomRef.current || fromMe) {
            // wait for DOM
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        }
        lastMsgRef.current = last;
    }, [thread.length, me?._id]);

    // Simple autosize
    useEffect(() => {
        const ta = inputRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(160, Math.max(40, ta.scrollHeight)) + "px";
    }, [text]);

    const sendTypingOn = useRef(
        debounce((cid) => indicateTyping(cid, true), 200)
    ).current;
    const sendTypingOff = useRef(
        debounce((cid) => indicateTyping(cid, false), 300)
    ).current;

    const onSend = async () => {
        const t = text.trim();
        if (!t || !id) return;
        try {
            await send(id, { text: t });
            setText("");
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        } catch (e) {
            console.error("Failed to send message:", e);
        }
    };

    const others = useMemo(() => {
        const mineId = me?._id;
        if (!mineId || !conv?.participants) return [];
        const arr = conv.participants.map((p) => p.user).filter(Boolean);
        return arr.filter((u) => u?._id && String(u._id) !== String(mineId));
    }, [conv, me]);

    const title = useMemo(() => {
        if (!conv) return "Conversation";
        if (conv.isGroup) return conv.title || "Group";
        if (others.length) {
            return others.map((u) => u?.name || u?.username || "Unknown").join(", ");
        }
        return "Conversation";
    }, [conv, others]);

    const anyoneTypingNames = useMemo(() => {
        if (!id) return "";
        const set = typing.get(id) || new Set();
        if (!set.size) return "";
        const ids = [...set].filter((uid) => String(uid) !== String(me?._id));
        if (!ids.length) return "";

        const nameMap = new Map();
        (conv?.participants || []).forEach((p) => {
            if (p.user?._id) {
                nameMap.set(String(p.user._id), p.user.name || p.user.username || "Someone");
            }
        });

        const names = ids.map((uid) => nameMap.get(String(uid)) || "Someone");
        const label =
            names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "");
        return `${label} ${names.length === 1 ? "is" : "are"} typing…`;
    }, [typing, id, conv, me]);

    const isOnline = useMemo(() => {
        if (!others.length) return false;
        return others.some((u) => getPresence(presence, u?._id));
    }, [others, presence]);

    const onTextChange = (e) => {
        setText(e.target.value);
        if (id) sendTypingOn(id);
    };
    const onBlur = () => {
        if (id) sendTypingOff(id);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-7.5rem)]">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
                <div className="container mx-auto max-w-2xl px-3 md:px-4 h-12 flex items-center gap-3">
                    <Link
                        to="/chats"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                                    }`}
                                title={isOnline ? "Online" : "Offline"}
                            />
                            <div className="font-semibold truncate">{title}</div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                            {conv?.isGroup
                                ? `${(conv?.participants || []).length} members`
                                : isOnline
                                    ? "Online"
                                    : "Offline"}
                        </div>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto">
                <div className="container mx-auto max-w-2xl px-3 md:px-4 py-3">
                    <MessageList
                        items={thread}
                        meId={me?._id}
                        participants={conv?.participants || []}
                        fmtTime={fmtTime}
                    />
                    {/* Typing indicator (as a bubble) */}
                    {anyoneTypingNames ? (
                        <div className="flex justify-start my-0.5">
                            <TypingBubble label={anyoneTypingNames} />
                        </div>
                    ) : null}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Composer */}
            <div className="border-t bg-background">
                <div className="container mx-auto max-w-2xl px-3 md:px-4 py-2">
                    <div className="flex items-end gap-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-xl"
                            title="Attach (coming soon)"
                            disabled
                        >
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        <Textarea
                            ref={inputRef}
                            value={text}
                            onChange={onTextChange}
                            onBlur={onBlur}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    onSend();
                                }
                            }}
                            placeholder="Message…"
                            className="rounded-2xl resize-none max-h-40"
                            rows={1}
                        />
                        <Button onClick={onSend} className="rounded-2xl" disabled={!text.trim()}>
                            <Send className="h-4 w-4 mr-1" />
                            Send
                        </Button>
                    </div>
                    <div className="h-2" />
                </div>
            </div>
        </div>
    );
}

/* --------------------- Message list (modern styling) --------------------- */

function MessageList({ items, meId, participants, fmtTime }) {
    // show a friendly empty state
    if (!items?.length) {
        return (
            <div className="py-8 text-center text-sm text-muted-foreground">Say hi 👋</div>
        );
    }

    // 1) ORDER: oldest → newest (so the last item renders at the bottom)
    const ordered = useMemo(() => {
        return [...items].sort((a, b) => {
            const ta = new Date(a.createdAt || a.timestamp || 0).getTime();
            const tb = new Date(b.createdAt || b.timestamp || 0).getTime();
            return ta - tb;
        });
    }, [items]);

    // Build an index of userId -> user (for avatars/names)
    const userMap = useMemo(() => {
        const m = new Map();
        (participants || []).forEach((p) => {
            if (p?.user?._id) m.set(String(p.user._id), p.user);
        });
        return m;
    }, [participants]);

    const rows = [];
    for (let i = 0; i < ordered.length; i++) {
        const curr = ordered[i];
        if (!curr) continue;

        const prev = ordered[i - 1];
        const next = ordered[i + 1];

        const currTime = curr.createdAt || curr.timestamp;
        const prevTime = prev?.createdAt || prev?.timestamp;

        const showDaySep = !prev || !isSameDay(prevTime, currTime);

        const currSenderId = String(curr?.sender?._id || curr?.sender || "");
        const prevSenderId = String(prev?.sender?._id || prev?.sender || "");
        const nextSenderId = String(next?.sender?._id || next?.sender || "");

        const mine = meId && currSenderId === String(meId);

        const groupedWithPrev =
            prev && currSenderId === prevSenderId && within5Min(prevTime, currTime);
        const groupedWithNext =
            next && currSenderId === nextSenderId && within5Min(currTime, next?.createdAt || next?.timestamp);

        const firstOfGroup = !groupedWithPrev;
        const lastOfGroup = !groupedWithNext;

        const key = curr._id || curr.id || `msg-${i}`;

        if (showDaySep && currTime) {
            rows.push(<DaySep key={`sep-${key}`} date={currTime} />);
        }

        rows.push(
            <div key={key} className={`flex ${mine ? "justify-end" : "justify-start"} my-0.5`}>
                <div className={`flex max-w-[88%] items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    {/* avatar only for others, only on the LAST bubble in a group */}
                    {!mine && lastOfGroup ? (
                        <ChatAvatar user={userMap.get(currSenderId)} />
                    ) : (
                        !mine && <div className="w-8" />
                    )}

                    <div className={`min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                        {/* name on first-of-group for group chats */}
                        {!mine && firstOfGroup && userMap.size > 1 ? (
                            <div className="text-[11px] mb-0.5 text-muted-foreground">
                                {userMap.get(currSenderId)?.name ||
                                    userMap.get(currSenderId)?.username ||
                                    "Someone"}
                            </div>
                        ) : null}

                        <Bubble
                            mine={!!mine}
                            groupedTop={groupedWithPrev}
                            groupedBottom={groupedWithNext}
                            text={curr.text || ""}
                            time={fmtTime(currTime)}
                            read={!!curr.read}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return <div className="space-y-0.5">{rows}</div>;
}


function ChatAvatar({ user }) {
    const letter =
        (user?.name && user.name[0]) ||
        (user?.username && user.username[0]) ||
        "?";
    return (
        <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl} />
            <AvatarFallback className="text-xs">{String(letter).toUpperCase()}</AvatarFallback>
        </Avatar>
    );
}

function DaySep({ date }) {
    if (!date) return null;
    let label;
    try {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (isSameDay(d, today)) label = "Today";
        else if (isSameDay(d, yesterday)) label = "Yesterday";
        else label = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    } catch {
        label = "Today";
    }

    return (
        <div className="my-3 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground/80">
            <Separator className="flex-1" />
            <span className="px-2 py-0.5 rounded-full bg-muted/60">{label}</span>
            <Separator className="flex-1" />
        </div>
    );
}

function Bubble({ mine, groupedTop, groupedBottom, text, time, read }) {
    const radius = mine
        ? `${groupedTop ? "rounded-tr-md" : "rounded-tr-2xl"} ${groupedBottom ? "rounded-br-md" : "rounded-br-2xl"} rounded-tl-2xl rounded-bl-2xl`
        : `${groupedTop ? "rounded-tl-md" : "rounded-tl-2xl"} ${groupedBottom ? "rounded-bl-md" : "rounded-bl-2xl"} rounded-tr-2xl rounded-br-2xl`;

    return (
        <div
            className={`px-3 py-2 text-sm shadow-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"
                } ${radius}`}
        >
            <div className="whitespace-pre-wrap break-words">{text}</div>
            {time ? (
                <div className={`mt-1 text-[10px] opacity-70 flex items-center gap-1 ${mine ? "" : "text-foreground/70"}`}>
                    <span>{time}</span>
                    {mine ? (read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />) : null}
                </div>
            ) : null}
        </div>
    );
}

function TypingBubble({ label }) {
    return (
        <div className="bg-muted rounded-2xl px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
            <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0.2s]" />
            </span>
            {label}
        </div>
    );
}
