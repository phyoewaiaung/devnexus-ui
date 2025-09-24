import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/providers/ChatProvider';
import { ChatsAPI } from '@/api/chat';
import { searchUsers } from '@/api/users';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    ArrowLeft, Send, Paperclip, Users2, UserPlus, Loader2,
    Search as SearchIcon, ChevronDown, X
} from 'lucide-react';
import { useNotifications } from '@/providers/NotificationsProvider';

/** ---------- tiny helpers ---------- */
const nameOf = (u) => u?.name || u?.username || 'Unknown';
const initials = (u) => (nameOf(u).match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase();

const isSameDay = (a, b) => {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};
const dayLabel = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date(today); y.setDate(today.getDate() - 1);
    if (isSameDay(d, today)) return 'Today';
    if (isSameDay(d, y)) return 'Yesterday';
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};
const prettyTime = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/** store may be Map or POJO depending on provider setup */
const isMap = (v) => v instanceof Map;
const readBucket = (store, key) => !store ? [] : isMap(store) ? (store.get(key) || []) : (store[key] || []);
const writeBucket = (store, key, value) => isMap(store) ? new Map(store).set(key, value) : { ...(store || {}), [key]: value };

function PresenceDot({ online }) {
    return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />;
}

function Bubble({ mine, msg, author, showAuthor }) {
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'} px-2`}>
            {!mine && (
                <Avatar className="h-7 w-7 mr-2 mt-5 shrink-0">
                    {author?.avatarUrl
                        ? <AvatarImage src={author.avatarUrl} alt={nameOf(author)} />
                        : <AvatarFallback>{(author?.name || author?.username || '?').slice(0, 2).toUpperCase()}</AvatarFallback>}
                </Avatar>
            )}
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${mine ? 'bg-[#3C81D2] text-white' : 'bg-muted'}`}>
                {showAuthor && !mine && <div className="text-xs font-medium mb-0.5 text-foreground/80">{nameOf(author)}</div>}
                {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                <div className={`mt-1 text-[11px] ${mine ? 'text-white/80' : 'text-muted-foreground'}`}>{prettyTime(msg.createdAt)}</div>
            </div>
        </div>
    );
}

function DateDivider({ when }) {
    return (
        <div className="flex items-center my-3 px-2">
            <div className="flex-1 h-px bg-border" />
            <span className="mx-3 text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border">{dayLabel(when)}</span>
            <div className="flex-1 h-px bg-border" />
        </div>
    );
}

/** -------------------- Page -------------------- */
export default function ConversationPage() {
    const { id } = useParams();
    const chatId = String(id);
    const navigate = useNavigate();

    const { user } = useAuth();
    const {
        messages: messagesMap,
        setMessages,
        send,
        indicateTyping,
        markRead,
        presence,
        typing,
        ensureJoinedRoom, // from provider
    } = useChat() || {};
    const { isOnline } = useNotifications();

    const [conversation, setConversation] = useState(null);
    const [text, setText] = useState('');

    const [invited, setInvited] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [membersOpen, setMembersOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteQuery, setInviteQuery] = useState('');
    const [inviteResults, setInviteResults] = useState([]);
    const [inviteSearching, setInviteSearching] = useState(false);
    const [inviteSelected, setInviteSelected] = useState([]);

    // NEW: separate local search for members sheet
    const [memberQuery, setMemberQuery] = useState('');

    const typingTimer = useRef(null);
    const scrollerRef = useRef(null);

    // ---- Bottom tracking: auto-scroll if user is near the bottom ----
    const NEAR_BOTTOM_PX = 96; // threshold
    const isNearBottomRef = useRef(true);
    const [pendingNewCount, setPendingNewCount] = useState(0);

    // ---- Responsive sheet side (bottom on mobile, right on desktop) ----
    const [isSmall, setIsSmall] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 640 : true);
    useEffect(() => {
        const onResize = () => setIsSmall(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const sheetSide = isSmall ? 'bottom' : 'right';

    /** read messages for this chat from provider */
    const rawMessages = useMemo(() => readBucket(messagesMap, chatId), [messagesMap, chatId]);

    /** Stable order: oldest → newest so newest appears at the bottom */
    const messages = useMemo(
        () => [...rawMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        [rawMessages]
    );

    const participants = conversation?.participants || [];
    const otherUsers = useMemo(
        () => (participants || []).filter((p) => String(p.user?._id || p.user) !== String(user?._id)).map((p) => p.user),
        [participants, user?._id]
    );

    const isGroup = !!conversation?.isGroup;
    const title = isGroup ? (conversation?.title || 'Group') : (otherUsers[0]?.name || otherUsers[0]?.username || 'Conversation');

    /** fetch the conversation meta; invited users can still see meta */
    const fetchConversation = useCallback(async () => {
        try {
            const convo = await ChatsAPI.getConversation(chatId);
            setConversation(convo);
            const meP = (convo.participants || []).find((p) => String(p.user?._id || p.user) === String(user?._id));
            setInvited((meP?.status || 'member') === 'invited');

            ensureJoinedRoom?.(chatId);
        } catch (e) {
            toast.error(e?.message || 'Failed to load conversation');
        }
    }, [chatId, user?._id, ensureJoinedRoom]);

    /** unified helper to upsert a batch; supports prepend (older) and append (newer) */
    const upsertBatch = useCallback((batch, mode = 'append') => {
        setMessages?.((prev) => {
            const current = readBucket(prev, chatId);
            const merged = mode === 'prepend' ? [...(batch || []), ...current] : [...current, ...(batch || [])];

            // De-dup by _id/clientMsgId while preserving order
            const seen = new Set();
            const unique = [];
            for (const m of merged) {
                const k = String(m._id || m.clientMsgId);
                if (!seen.has(k)) { seen.add(k); unique.push(m); }
            }
            return writeBucket(prev, chatId, unique);
        });
    }, [chatId, setMessages]);

    /** initial page load: fetch latest page and jump to bottom */
    const loadInitial = useCallback(async () => {
        try {
            ensureJoinedRoom?.(chatId);

            const { messages: batch, nextCursor: cursor } = await ChatsAPI.listMessages(chatId, { limit: 30 });
            upsertBatch(batch || [], 'append');
            setNextCursor(cursor || null);
            if (batch?.length) markRead?.(chatId);

            // Scroll to bottom after paint
            requestAnimationFrame(() => {
                const el = scrollerRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                isNearBottomRef.current = true;
                setPendingNewCount(0);
            });
        } catch {
            // invited users may receive 403 here — banner explains why
        }
    }, [chatId, upsertBatch, markRead, ensureJoinedRoom]);

    useEffect(() => { fetchConversation(); }, [fetchConversation]);
    useEffect(() => { loadInitial(); }, [loadInitial]);

    /** typing indicator lifecycle */
    useEffect(() => () => {
        if (typingTimer.current) clearTimeout(typingTimer.current);
        try { indicateTyping?.(chatId, false); } catch { }
    }, [chatId, indicateTyping]);

    const onTextChange = (v) => {
        setText(v);
        try {
            if (typingTimer.current) clearTimeout(typingTimer.current);
            indicateTyping?.(chatId, true);
            typingTimer.current = setTimeout(() => indicateTyping?.(chatId, false), 1500);
        } catch { }
    };

    /** send message */
    const sendNow = async () => {
        const t = text.trim();
        if (!t || invited) return;

        try {
            setText('');
            if (typingTimer.current) clearTimeout(typingTimer.current);
            try { indicateTyping?.(chatId, false); } catch { }
            await send?.(chatId, { text: t });

            // Always stick to bottom on your own send
            requestAnimationFrame(() => {
                const el = scrollerRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                isNearBottomRef.current = true;
                setPendingNewCount(0);
            });
        } catch (e) {
            toast.error(e?.message || 'Failed to send');
        }
    };

    /** accept/decline invitations */
    const accept = async () => {
        try {
            await ChatsAPI.acceptInvite(chatId);
            await fetchConversation();
            await loadInitial();
            toast.success('Joined the room');
        } catch (e) {
            toast.error(e?.message || 'Failed to accept');
        }
    };
    const decline = async () => {
        try {
            await ChatsAPI.declineInvite(chatId);
            toast.success('Invitation declined');
            navigate('/chats');
        } catch (e) {
            toast.error(e?.message || 'Failed to decline');
        }
    };

    /** infinite scroll up */
    const loadOlder = useCallback(async () => {
        if (!nextCursor || loadingMore || invited) return;
        const el = scrollerRef.current;
        if (!el) return;

        setLoadingMore(true);
        const prevH = el.scrollHeight;
        const prevTop = el.scrollTop;

        try {
            const { messages: batch, nextCursor: cursor } = await ChatsAPI.listMessages(chatId, { cursor: nextCursor, limit: 30 });
            upsertBatch(batch || [], 'prepend');
            setNextCursor(cursor || null);

            // Restore viewport so content doesn't jump
            requestAnimationFrame(() => {
                const delta = el.scrollHeight - prevH;
                el.scrollTop = prevTop + delta;
            });
        } catch (e) {
            toast.error(e?.message || 'Failed to load earlier');
        } finally {
            setLoadingMore(false);
        }
    }, [chatId, nextCursor, loadingMore, invited, upsertBatch]);

    // rAF-throttled scroll handler
    const scrollBusy = useRef(false);
    const onScroll = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        if (scrollBusy.current) return;
        scrollBusy.current = true;
        requestAnimationFrame(() => {
            // mark near-bottom state
            const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
            const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
            isNearBottomRef.current = nearBottom;

            // trigger load older when near top
            if (el.scrollTop <= 64 && nextCursor && !loadingMore) loadOlder();

            // If user returns to bottom, clear the pending pill and mark read
            if (nearBottom && pendingNewCount > 0) {
                setPendingNewCount(0);
                markRead?.(chatId);
            }

            scrollBusy.current = false;
        });
    }, [loadOlder, nextCursor, loadingMore, pendingNewCount, markRead, chatId]);

    /** invite search (excludes existing members) */
    const memberIds = useMemo(() => new Set((participants || []).map((p) => String(p.user?._id || p.user))), [participants]);
    useEffect(() => {
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            if (!inviteOpen || !inviteQuery) { setInviteResults([]); return; }
            try {
                setInviteSearching(true);
                const { users } = await searchUsers(inviteQuery, { signal: ctrl.signal });
                setInviteResults((users || []).filter((u) => !memberIds.has(String(u._id))));
            } catch {/* ignore */ } finally { setInviteSearching(false); }
        }, 250);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [inviteOpen, inviteQuery, memberIds]);

    const inviteToggle = (u) => {
        setInviteSelected((prev) =>
            prev.some((x) => String(x._id) === String(u._id)) ? prev.filter((x) => String(x._id) !== String(u._id)) : [...prev, u]
        );
    };
    const sendInvites = async () => {
        try {
            if (!inviteSelected.length) return;
            await ChatsAPI.invite(chatId, inviteSelected.map((u) => u._id));
            toast.success('Invites sent');
            setInviteSelected([]); setInviteQuery(''); setInviteOpen(false);
        } catch (e) {
            toast.error(e?.message || 'Failed to invite');
        }
    };

    /** group rows w/ date dividers (rendering only) */
    const listWithDividers = useMemo(() => {
        const out = [];
        let prev = null;
        for (const m of messages) {
            if (!prev || !isSameDay(prev.createdAt, m.createdAt)) {
                out.push({ _type: 'divider', when: m.createdAt, _id: `d-${m._id || m.clientMsgId}` });
            }
            const mine = String(m.sender?._id || m.sender) === String(user?._id);
            const sameAuthorAsPrev =
                prev && String(prev.sender?._id || prev.sender) === String(m.sender?._id || m.sender) && isSameDay(prev.createdAt, m.createdAt);
            const showAuthor = isGroup && !mine && !sameAuthorAsPrev;

            out.push({ _type: 'msg', msg: m, mine, showAuthor, mineBool: mine });
            prev = m;
        }
        return out;
    }, [messages, user?._id, isGroup]);

    // ---- Auto scroll on new messages ----
    const lastCountRef = useRef(messages.length);
    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        const newCount = messages.length - lastCountRef.current;
        lastCountRef.current = messages.length;
        if (newCount <= 0) return;

        const lastMsg = messages[messages.length - 1];
        const mine = String(lastMsg?.sender?._id || lastMsg?.sender) === String(user?._id);

        if (mine || isNearBottomRef.current) {
            requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight;
                isNearBottomRef.current = true;
                setPendingNewCount(0);
                markRead?.(chatId);
            });
        } else {
            setPendingNewCount((n) => n + newCount);
        }
    }, [messages, user?._id, markRead, chatId]);

    const typingSet = typing?.get ? typing.get(chatId) : new Set();
    const isSomeoneTyping = typingSet && typingSet.size > 0 && !typingSet.has(user?._id);

    const dmOnline = !isGroup && otherUsers[0]?._id && isOnline(String(otherUsers[0]._id));

    return (
        <div className="h-[85vh] max-h-[85vh] overflow-hidden bg-background flex flex-col">
            {/* Header */}
            <div className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-3">
                    {/* <Link to="/chats"><Button variant="ghost" size="icon" aria-label="Back to chats"><ArrowLeft className="h-5 w-5" /></Button></Link> */}
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Back"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>

                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            {isGroup
                                ? <AvatarFallback>{(title || 'G').slice(0, 2).toUpperCase()}</AvatarFallback>
                                : (otherUsers[0]?.avatarUrl
                                    ? <AvatarImage src={otherUsers[0].avatarUrl} alt={title} />
                                    : <AvatarFallback>{(title || 'C').slice(0, 2).toUpperCase()}</AvatarFallback>
                                )}
                        </Avatar>
                        <div>
                            <div className="font-semibold leading-none flex items-center gap-2">
                                {title}
                                {isGroup && <Badge variant="secondary">Group</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {isGroup && (
                                    <>
                                        <Users2 className="h-3.5 w-3.5" /> {participants.length || 1}
                                    </>
                                )}
                                {!isGroup && otherUsers[0]?._id && (
                                    <> <PresenceDot online={!!dmOnline} /> {dmOnline ? 'Online' : 'Offline'}</>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        {isGroup && !invited && (
                            <>
                                <Button size="sm" variant="outline" onClick={() => setMembersOpen(true)}>Members</Button>
                                <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} className="gap-1">
                                    <UserPlus className="h-4 w-4" /> Add
                                </Button>
                            </>
                        )}
                        {invited && (
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="secondary" onClick={accept}>Accept</Button>
                                <Button size="sm" variant="ghost" onClick={decline} className="text-destructive">Decline</Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Message pane */}
            <div className="flex-1">
                <Card className="mx-auto max-w-3xl rounded-none sm:rounded-xl sm:mt-3 sm:mb-0 h-full">
                    <div
                        ref={scrollerRef}
                        onScroll={onScroll}
                        className="relative h-[calc(85svh-56px-92px)] sm:h-[calc(85svh-56px-112px)] overflow-y-auto p-2 sm:p-4"
                    >
                        {invited && (
                            <div className="text-center mb-3 text-sm text-muted-foreground">
                                You've been invited to this room. Accept to view and send messages.
                            </div>
                        )}

                        {!invited && (
                            <>
                                {/* Sticky top loader while we fetch older pages */}
                                {loadingMore && (
                                    <div className="sticky top-0 z-10 flex justify-center mb-2">
                                        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-background/95 border rounded-full px-2 py-1">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading earlier messages…
                                        </div>
                                    </div>
                                )}

                                {listWithDividers.map((row) =>
                                    row._type === 'divider' ? (
                                        <DateDivider key={row._id} when={row.when} />
                                    ) : (
                                        <div key={row.msg._id || row.msg.clientMsgId} className="py-1">
                                            <Bubble
                                                mine={row.mine}
                                                msg={row.msg}
                                                author={
                                                    row.mine
                                                        ? user
                                                        : otherUsers.find((o) => String(o?._id || o) === String(row.msg.sender?._id || row.msg.sender))
                                                        || participants.map(p => p.user).find((u) => String(u?._id || u) === String(row.msg.sender?._id || row.msg.sender))
                                                }
                                                showAuthor={row.showAuthor}
                                            />
                                        </div>
                                    )
                                )}
                            </>
                        )}

                        {/* New messages pill when scrolled up */}
                        {!invited && pendingNewCount > 0 && (
                            <button
                                onClick={() => {
                                    const el = scrollerRef.current;
                                    if (!el) return;
                                    el.scrollTop = el.scrollHeight;
                                    isNearBottomRef.current = true;
                                    setPendingNewCount(0);
                                    markRead?.(chatId);
                                }}
                                className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-28 z-20 inline-flex items-center gap-1 rounded-full border bg-background/95 px-3 py-1 text-xs shadow hover:bg-background"
                                aria-label="Jump to latest"
                            >
                                <ChevronDown className="h-3.5 w-3.5" />
                                new message
                            </button>
                        )}
                    </div>
                </Card>
            </div>

            {/* Composer */}
            <div className="sticky bottom-0 z-10 bg-background border-t">
                <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2">
                    <Card className="p-2 sm:p-3">
                        <div className="flex items-end gap-2">
                            <Button variant="outline" size="icon" className="shrink-0" disabled aria-label="Attach file">
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Textarea
                                value={text}
                                onChange={(e) => onTextChange(e.target.value)}
                                placeholder={invited ? 'Accept the invite to send messages…' : 'Write a message…'}
                                className="min-h-[44px] max-h-40"
                                disabled={invited}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNow(); } }}
                            />
                            <Button onClick={sendNow} className="shrink-0" disabled={!text.trim() || invited}>
                                <Send className="h-4 w-4 mr-1" /> Send
                            </Button>
                        </div>
                        {isSomeoneTyping && <div className="mt-1 text-xs text-muted-foreground px-1">Someone is typing…</div>}
                    </Card>
                </div>
            </div>

            {/* Members sheet */}
            <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
                <SheetContent
                    side={sheetSide}
                    className={`w-full sm:max-w-md p-0 ${sheetSide === 'bottom' ? 'h-[90svh]' : ''}`}
                >
                    {/* Sticky header with safe-area padding */}
                    <div
                        className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between"
                        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px))' }}
                    >
                        <div>
                            <SheetTitle>Members</SheetTitle>
                            <SheetDescription>{participants.length} people</SheetDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMembersOpen(false)}
                            aria-label="Close members"
                            className="rounded-full hover:bg-accent/40"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Local search/filter inside the sheet */}
                    <div className="p-3">
                        <div className="relative">
                            <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={memberQuery}
                                onChange={(e) => setMemberQuery(e.target.value)}
                                placeholder="Search members…"
                                className="pl-9"
                                aria-label="Search members"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="px-2 pb-4 overflow-y-auto" style={{ maxHeight: sheetSide === 'bottom' ? 'calc(90svh - 120px)' : 'calc(100svh - 140px)' }}>
                        {(participants || [])
                            .filter((p) => {
                                const u = p.user || {};
                                const needle = memberQuery.trim().toLowerCase();
                                if (!needle) return true;
                                return (
                                    (u.name || '').toLowerCase().includes(needle) ||
                                    (u.username || '').toLowerCase().includes(needle)
                                );
                            })
                            .map((p) => {
                                const u = p.user || {};
                                const isMe = String(u._id) === String(user?._id);
                                const role = (p.role || 'member').toLowerCase();
                                const status = (p.status || 'member').toLowerCase();

                                const online =
                                    (!!u._id && (typeof isOnline === 'function' ? isOnline(String(u._id)) : false)) ||
                                    !!presence?.get?.(String(u._id));

                                return (
                                    <div
                                        key={String(u._id)}
                                        className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-accent/40 active:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative">
                                                <Avatar className="h-9 w-9">
                                                    {u.avatarUrl ? (
                                                        <AvatarImage src={u.avatarUrl} alt={nameOf(u)} />
                                                    ) : (
                                                        <AvatarFallback>{initials(u)}</AvatarFallback>
                                                    )}
                                                </Avatar>
                                                <span className="absolute -bottom-0.5 -right-0.5">
                                                    <PresenceDot online={online} />
                                                </span>
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-medium truncate">
                                                        {nameOf(u)} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                                                    </div>
                                                </div>
                                                <div className="mt-0.5 flex items-center gap-1 text-xs">
                                                    <Badge variant={role === 'owner' ? 'default' : 'secondary'} className="capitalize">
                                                        {role}
                                                    </Badge>
                                                    {status !== 'member' && (
                                                        <Badge variant="outline" className="capitalize">{status}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {/* (Future quick actions can go here) */}
                                    </div>
                                );
                            })}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Invite dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>Add people</DialogTitle></DialogHeader>

                    <div className="space-y-3">
                        <div className="relative">
                            <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input value={inviteQuery} onChange={(e) => setInviteQuery(e.target.value)} placeholder="Search people…" className="pl-9" />
                        </div>
                        <div className="max-h-64 overflow-auto rounded-lg border">
                            {!inviteQuery ? (
                                <p className="text-sm text-muted-foreground p-3">Type a name or username</p>
                            ) : inviteResults.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-3">No matches</p>
                            ) : (
                                inviteResults.map((u) => (
                                    <button
                                        key={u._id}
                                        onClick={() => setInviteSelected((prev) =>
                                            prev.some((x) => String(x._id) === String(u._id)) ? prev.filter((x) => String(x._id) !== String(u._id)) : [...prev, u]
                                        )}
                                        className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-accent ${inviteSelected.some((x) => String(x._id) === String(u._id)) ? 'bg-accent/60' : ''}`}
                                    >
                                        <Avatar className="h-8 w-8">
                                            {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={nameOf(u)} /> : <AvatarFallback>{initials(u)}</AvatarFallback>}
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium truncate">{nameOf(u)}</p>
                                                {u.username && <span className="text-xs text-muted-foreground truncate">@{u.username}</span>}
                                            </div>
                                        </div>
                                        {inviteSearching && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
                        <Button onClick={sendInvites} disabled={inviteSelected.length === 0} className="gap-2">
                            <UserPlus className="h-4 w-4" /> Invite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
