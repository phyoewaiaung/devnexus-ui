import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    ArrowLeft, Send, Users2, UserPlus, Loader2,
    Search as SearchIcon, ChevronDown, X, Code2, Eye, Edit3, Image as ImageIcon,
    Trash2, LogOut, ShieldAlert
} from 'lucide-react';
import { useNotifications } from '@/providers/NotificationsProvider';
import RichPostBody from '@/components/RichPostBody';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
    AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';

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

const isMap = (v) => v instanceof Map;
const readBucket = (store, key) => !store ? [] : isMap(store) ? (store.get(key) || []) : (store[key] || []);
const writeBucket = (store, key, value) => isMap(store) ? new Map(store).set(key, value) : { ...(store || {}), [key]: value };

/** absolute URL helper */
const toAbs = (u) => {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    const base = import.meta.env.VITE_API_ORIGIN || window.location.origin;
    return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
};

/** image classifier (robust) */
const isImageLike = (a) => {
    const t = String(a?.type || '').toLowerCase();
    if (t.startsWith('image/')) return true;
    const u = String(a?.url || '');
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(u);
};

function PresenceDot({ online }) {
    return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />;
}

function ImageAttachment({ url, alt }) {
    return (
        <div className="mt-2">
            <img
                src={toAbs(url)}
                alt={alt || 'Image'}
                className="max-w-full rounded-lg border border-border object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.alt = 'Image unavailable'; }}
            />
        </div>
    );
}

function Bubble({ mine, msg, author, showAuthor }) {
    const images = Array.isArray(msg.attachments)
        ? msg.attachments.filter((a) => a?.url && isImageLike(a))
        : [];

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
                {showAuthor && !mine && <div className="text-xs font-medium mb-1 text-foreground/80">{nameOf(author)}</div>}
                {msg.text && (
                    <div className={`whitespace-pre-wrap break-words ${mine ? '[&_code]:bg-white/10' : ''}`}>
                        <RichPostBody raw={msg.text} mine={mine} />
                    </div>
                )}
                {images.map((img, idx) => (
                    <ImageAttachment key={`${img.url}-${idx}`} url={img.url} alt={img.name || 'Image'} />
                ))}
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

/** Messenger-like typing string */
function formatTypingNames(names) {
    if (!names || names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing…`;
}

/* -------------------- Page -------------------- */
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
        ensureJoinedRoom,
    } = useChat() || {};
    const { isOnline } = useNotifications();

    const [conversation, setConversation] = useState(null);
    const [text, setText] = useState('');

    /** Local attachments (no upload until Send): [{file, url, type, name, size}] */
    const [files, setFiles] = useState([]);
    const fileRef = useRef(null);
    const [sending, setSending] = useState(false);

    /** Code inserter + preview */
    const [codeOpen, setCodeOpen] = useState(false);
    const [codeLang, setCodeLang] = useState('javascript');
    const [codeText, setCodeText] = useState('');
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    const [invited, setInvited] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [membersOpen, setMembersOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteQuery, setInviteQuery] = useState('');
    const [inviteResults, setInviteResults] = useState([]);
    const [inviteSearching, setInviteSearching] = useState(false);
    const [inviteSelected, setInviteSelected] = useState([]);

    const [memberQuery, setMemberQuery] = useState('');

    // NEW: confirm dialogs
    const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const typingTimer = useRef(null);
    const scrollerRef = useRef(null);

    const NEAR_BOTTOM_PX = 96;
    const isNearBottomRef = useRef(true);
    const [pendingNewCount, setPendingNewCount] = useState(0);

    /** read messages for this chat from provider */
    const rawMessages = useMemo(() => readBucket(messagesMap, chatId), [messagesMap, chatId]);
    const messages = useMemo(
        () => [...rawMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        [rawMessages]
    );

    const participants = conversation?.participants || [];
    const otherUsers = useMemo(
        () => (participants || []).filter((p) => String(p.user?._id || p.user) !== String(user?._id)).map((p) => p.user),
        [participants, user?._id]
    );

    const idToUser = useMemo(() => {
        const m = new Map();
        for (const p of (participants || [])) {
            const uid = String(p.user?._id || p.user);
            m.set(uid, p.user);
        }
        return m;
    }, [participants]);

    const isGroup = !!conversation?.isGroup;
    const title = isGroup ? (conversation?.title || 'Group') : (otherUsers[0]?.name || otherUsers[0]?.username || 'Conversation');

    // NEW: my role (for group controls)
    const myRole = useMemo(() => {
        const meP = (participants || []).find((p) => String(p.user?._id || p.user) === String(user?._id));
        return (meP?.role || 'member').toLowerCase();
    }, [participants, user?._id]);

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

    const upsertBatch = useCallback((batch, mode = 'append') => {
        setMessages?.((prev) => {
            const current = readBucket(prev, chatId);
            const merged = mode === 'prepend' ? [...(batch || []), ...current] : [...current, ...(batch || [])];
            const seen = new Set(); const unique = [];
            for (const m of merged) {
                const k = String(m._id || m.clientMsgId);
                if (!seen.has(k)) { seen.add(k); unique.push(m); }
            }
            return writeBucket(prev, chatId, unique);
        });
    }, [chatId, setMessages]);

    const loadInitial = useCallback(async () => {
        try {
            ensureJoinedRoom?.(chatId);
            const { messages: batch, nextCursor: cursor } = await ChatsAPI.listMessages(chatId, { limit: 30 });
            upsertBatch(batch || [], 'append');
            setNextCursor(cursor || null);
            if (batch?.length) markRead?.(chatId);
            requestAnimationFrame(() => {
                const el = scrollerRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                isNearBottomRef.current = true;
                setPendingNewCount(0);
            });
        } catch { /* invited 403 is fine */ }
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

    /** attachments: add/remove/preview (no upload yet) */
    const MAX_FILE_MB = 8;
    const acceptFiles = (fileList) => {
        const incoming = Array.from(fileList || []);
        if (!incoming.length) return;
        const next = [];
        for (const f of incoming) {
            if (!f.type.startsWith('image/')) { toast.error('Only images are supported for now.'); continue; }
            if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`Each image must be ≤ ${MAX_FILE_MB}MB.`); continue; }
            const url = URL.createObjectURL(f);
            next.push({ file: f, url, type: 'image', name: f.name, size: f.size });
        }
        setFiles((prev) => [...prev, ...next]);
    };
    const removeFile = (i) => {
        setFiles((prev) => {
            const copy = [...prev];
            const [rm] = copy.splice(i, 1);
            try { if (rm?.url) URL.revokeObjectURL(rm.url); } catch { }
            return copy;
        });
    };

    const onPaste = (e) => {
        const item = [...(e.clipboardData?.items || [])].find((it) => it.kind === 'file' && it.type.startsWith('image/'));
        if (item) {
            const f = item.getAsFile();
            if (f) acceptFiles([f]);
        }
    };
    const onDrop = (e) => {
        e.preventDefault();
        acceptFiles(e.dataTransfer?.files);
    };

    /** Code insertion -> fenced block appended to text area */
    const insertCode = () => {
        if (!codeText.trim()) return;
        const block = `\n\n\`\`\`${codeLang}\n${codeText.replace(/\n$/, '')}\n\`\`\`\n`;
        setText((t) => (t || '').concat(block));
        setCodeText(''); setCodeOpen(false);
        setIsPreviewMode(false);
    };

    /** send message: upload images then send */
    const sendNow = async () => {
        const trimmed = text.trim();
        const hasFiles = files.length > 0;
        if ((!trimmed && !hasFiles) || invited || sending) return;

        try {
            setSending(true);

            // 1) Upload all images in one request
            let attachments = [];
            if (hasFiles) {
                const { attachments: uploaded } = await ChatsAPI.uploadAttachments(files.map(f => f.file));
                attachments = uploaded || [];
            }

            // 2) send the message
            const clientMsgId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            await send?.(chatId, { text: trimmed, attachments, clientMsgId });

            // 3) clear composer
            setText('');
            files.forEach((f) => { try { if (f.url) URL.revokeObjectURL(f.url); } catch { } });
            setFiles([]);
            try { indicateTyping?.(chatId, false); } catch { }

            // scroll to bottom
            requestAnimationFrame(() => {
                const el = scrollerRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                isNearBottomRef.current = true;
                setPendingNewCount(0);
            });
        } catch (e) {
            toast.error(e?.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    /** accept/decline */
    const accept = async () => {
        try {
            await ChatsAPI.acceptInvite(chatId);
            await fetchConversation();
            await loadInitial();
            toast.success('Joined the room');
        } catch (e) { toast.error(e?.message || 'Failed to accept'); }
    };
    const decline = async () => {
        try { await ChatsAPI.declineInvite(chatId); toast.success('Invitation declined'); }
        catch (e) { toast.error(e?.message || 'Failed to decline'); }
        finally { navigate('/chats'); }
    };

    /** infinite scroll up */
    const loadOlder = useCallback(async () => {
        if (!nextCursor || loadingMore || invited) return;
        const el = scrollerRef.current; if (!el) return;

        setLoadingMore(true);
        const prevH = el.scrollHeight; const prevTop = el.scrollTop;

        try {
            const { messages: batch, nextCursor: cursor } = await ChatsAPI.listMessages(chatId, { cursor: nextCursor, limit: 30 });
            upsertBatch(batch || [], 'prepend');
            setNextCursor(cursor || null);
            requestAnimationFrame(() => {
                const delta = el.scrollHeight - prevH;
                el.scrollTop = prevTop + delta;
            });
        } catch (e) { toast.error(e?.message || 'Failed to load earlier'); }
        finally { setLoadingMore(false); }
    }, [chatId, nextCursor, loadingMore, invited, upsertBatch]);

    const scrollBusy = useRef(false);
    const onScroll = useCallback(() => {
        const el = scrollerRef.current;
        if (!el || scrollBusy.current) return;
        scrollBusy.current = true;
        requestAnimationFrame(() => {
            const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
            const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
            isNearBottomRef.current = nearBottom;

            if (el.scrollTop <= 64 && nextCursor && !loadingMore) loadOlder();

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
        } catch (e) { toast.error(e?.message || 'Failed to invite'); }
    };

    /** rows with date dividers */
    const listWithDividers = useMemo(() => {
        const out = []; let prev = null;
        for (const m of messages) {
            if (!prev || !isSameDay(prev.createdAt, m.createdAt)) {
                out.push({ _type: 'divider', when: m.createdAt, _id: `d-${m._id || m.clientMsgId}` });
            }
            const mine = String(m.sender?._id || m.sender) === String(user?._id);
            const sameAuthorAsPrev = prev && String(prev.sender?._id || prev.sender) === String(m.sender?._id || m.sender) && isSameDay(prev.createdAt, m.createdAt);
            const showAuthor = isGroup && !mine && !sameAuthorAsPrev;

            out.push({ _type: 'msg', msg: m, mine, showAuthor, mineBool: mine });
            prev = m;
        }
        return out;
    }, [messages, user?._id, isGroup]);

    /** auto scroll on new messages */
    const lastCountRef = useRef(messages.length);
    useEffect(() => {
        const el = scrollerRef.current; if (!el) return;
        const newCount = messages.length - lastCountRef.current;
        lastCountRef.last = messages.length;
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

    /** typing names */
    const typingSet = typing?.get ? typing.get(chatId) : new Set();
    const typingNames = useMemo(() => {
        if (!typingSet || typingSet.size === 0) return [];
        const mineId = String(user?._id || '');
        const ids = Array.from(typingSet).map(String).filter((id) => id && id !== mineId);
        const names = []; const seen = new Set();
        for (const id of ids) {
            const u = idToUser.get(id);
            const label = nameOf(u || {});
            if (label && !seen.has(label)) { seen.add(label); names.push(label); }
        }
        return names;
    }, [typingSet, idToUser, user?._id]);
    const typingText = formatTypingNames(typingNames);

    const dmOnline = !isGroup && otherUsers[0]?._id && isOnline(String(otherUsers[0]._id));

    /** member -> profile */
    const goProfile = useCallback((u) => {
        if (!u) return;
        navigate(`/u/${u.username || u._id}`);
        setMembersOpen(false);
    }, [navigate]);

    // --- NEW: action handlers
    const leaveGroup = async () => {
        try {
            await ChatsAPI.leaveConversation(chatId);
            toast.success('You left the group');
            navigate('/chats');
        } catch (e) {
            toast.error(e?.message || 'Failed to leave group');
        }
    };
    const deleteConversation = async () => {
        try {
            await ChatsAPI.deleteConversation(chatId);
            toast.success(isGroup ? 'Group deleted' : 'Chat deleted');
            navigate('/chats');
        } catch (e) {
            toast.error(e?.message || 'Failed to delete');
        }
    };

    // ------ RENDER ------
    return (
        <div className="h-[88svh] max-h-[88svh] overflow-hidden bg-background flex flex-col">
            {/* Header */}
            <div className="border-b bg-background/80 backdrop-blur shrink-0">
                <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-3">
                    <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)}>
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
                                {isGroup && (<><Users2 className="h-3.5 w-3.5" /> {participants.length || 1}</>)}
                                {!isGroup && otherUsers[0]?._id && (<><PresenceDot online={!!dmOnline} /> {dmOnline ? 'Online' : 'Offline'}</>)}
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

                        {/* NEW: destructive actions */}
                        {!invited && (
                            <>
                                {!isGroup && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="gap-1"
                                        onClick={() => setConfirmDeleteOpen(true)}
                                        aria-label="Delete chat"
                                    >
                                        <Trash2 className="h-4 w-4" /> Delete
                                    </Button>
                                )}

                                {isGroup && myRole !== 'owner' && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="gap-1"
                                        onClick={() => setConfirmLeaveOpen(true)}
                                        aria-label="Leave group"
                                    >
                                        <LogOut className="h-4 w-4" /> Leave
                                    </Button>
                                )}

                                {isGroup && myRole === 'owner' && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="gap-1"
                                        onClick={() => setConfirmDeleteOpen(true)}
                                        aria-label="Delete group"
                                    >
                                        <ShieldAlert className="h-4 w-4" /> Delete group
                                    </Button>
                                )}
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
            <div className="flex-1 min-h-0">
                <Card className="mx-auto max-w-3xl rounded-none sm:rounded-xl sm:mt-3 sm:mb-0 h-full">
                    <div
                        ref={scrollerRef}
                        onScroll={onScroll}
                        className="relative h-full overflow-y-auto p-2 sm:p-4"
                    >
                        {invited && (
                            <div className="text-center mb-3 text-sm text-muted-foreground">
                                You've been invited to this room. Accept to view and send messages.
                            </div>
                        )}

                        {!invited && (
                            <>
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

                        {!invited && pendingNewCount > 0 && (
                            <button
                                onClick={() => {
                                    const el = scrollerRef.current; if (!el) return;
                                    el.scrollTop = el.scrollHeight;
                                    isNearBottomRef.current = true;
                                    setPendingNewCount(0);
                                    markRead?.(chatId);
                                }}
                                className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-24 z-20 inline-flex items-center gap-1 rounded-full border bg-background/95 px-3 py-1 text-xs shadow hover:bg-background"
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
            <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
                <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2">
                    <Card className="relative p-2 py-4">

                        {/* Typing indicator (TOP) */}
                        <div className="absolute top-0 px-2 text-[11px] text-muted-foreground flex items-center overflow-hidden">
                            {typingText ? (
                                <div className="inline-flex items-center gap-1">
                                    <span className="truncate max-w-[220px] sm:max-w-[360px]">{typingText}</span>
                                    <span className="inline-flex">
                                        <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:0ms]" />
                                        <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:120ms] mx-1" />
                                        <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:240ms]" />
                                    </span>
                                </div>
                            ) : null}
                        </div>

                        {/* One-row composer */}
                        <div
                            className="mt-1 flex items-end gap-2"
                            onPaste={onPaste}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={onDrop}
                        >
                            {/* Left tools */}
                            <div className="flex items-center gap-1.5 pb-0.5">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                type="button"
                                                onClick={() => fileRef.current?.click()}
                                                aria-label="Add photos"
                                                className="shrink-0"
                                            >
                                                <ImageIcon className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="center">Photos</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => acceptFiles(e.target.files)}
                                />

                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                type="button"
                                                onClick={() => setCodeOpen(true)}
                                                aria-label="Insert code"
                                                className="shrink-0"
                                            >
                                                <Code2 className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="center">Code</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={isPreviewMode ? 'default' : 'outline'}
                                                size="icon"
                                                type="button"
                                                onClick={() => setIsPreviewMode((v) => !v)}
                                                className="shrink-0"
                                                aria-label={isPreviewMode ? 'Edit' : 'Preview'}
                                            >
                                                {isPreviewMode ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="center">
                                            {isPreviewMode ? 'Edit' : 'Preview'}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>

                            {/* Textarea */}
                            {isPreviewMode ? (
                                <div className="flex-1 min-h-[38px] max-h-36 whitespace-pre-wrap py-2 px-3 text-sm border rounded-md bg-background">
                                    {text.trim() ? (
                                        <RichPostBody raw={text} />
                                    ) : (
                                        <span className="text-muted-foreground">Nothing to preview…</span>
                                    )}
                                </div>
                            ) : (
                                <Textarea
                                    value={text}
                                    onChange={(e) => onTextChange(e.target.value)}
                                    placeholder={invited ? 'Accept the invite to send…' : 'Write a message…'}
                                    className="flex-1 min-h-[38px] max-h-36 text-sm resize-none"
                                    disabled={invited}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendNow();
                                        }
                                    }}
                                />
                            )}

                            {/* Send */}
                            <div className="flex items-center gap-1.5 pb-0.5">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                onClick={sendNow}
                                                size="sm"
                                                className="shrink-0"
                                                disabled={invited || sending || (!text.trim() && files.length === 0)}
                                                aria-label="Send"
                                            >
                                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="center">Send</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>

                        {/* Attachments previews */}
                        {files.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {files.map((f, i) => (
                                    <div key={`${f.url}-${i}`} className="relative rounded-lg overflow-hidden border">
                                        <img src={f.url} alt={f.name} className="h-20 w-20 object-cover" />
                                        <button
                                            type="button"
                                            className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 border shadow"
                                            onClick={() => removeFile(i)}
                                            aria-label="Remove image"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Members sheet */}
            <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md p-0">
                    <div
                        className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between"
                        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px))' }}
                    >
                        <div>
                            <SheetTitle>Members</SheetTitle>
                            <SheetDescription>{participants.length} people</SheetDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setMembersOpen(false)} aria-label="Close members" className="rounded-full hover:bg-accent/40">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="p-3">
                        <div className="relative">
                            <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search members…" className="pl-9" aria-label="Search members" />
                        </div>
                    </div>

                    <div className="px-2 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(100svh - 140px)' }}>
                        {(participants || [])
                            .filter((p) => {
                                const u = p.user || {};
                                const needle = memberQuery.trim().toLowerCase();
                                if (!needle) return true;
                                return ((u.name || '').toLowerCase().includes(needle) || (u.username || '').toLowerCase().includes(needle));
                            })
                            .map((p) => {
                                const u = p.user || {};
                                const isMe = String(u._id) === String(user?._id);
                                const role = (p.role || 'member').toLowerCase();
                                const status = (p.status || 'member').toLowerCase();
                                const online = (!!u._id && (typeof isOnline === 'function' ? isOnline(String(u._id)) : false)) || !!presence?.get?.(String(u._id));

                                return (
                                    <button
                                        key={String(u._id)}
                                        onClick={() => goProfile(u)}
                                        className="w-full text-left flex items-center justify-between px-3 py-2 rounded-xl hover:bg-accent/40 active:bg-accent/50 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative">
                                                <Avatar className="h-9 w-9">
                                                    {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={nameOf(u)} /> : <AvatarFallback>{initials(u)}</AvatarFallback>}
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
                                                    <Badge variant={role === 'owner' ? 'default' : 'secondary'} className="capitalize">{role}</Badge>
                                                    {status !== 'member' && (<Badge variant="outline" className="capitalize">{status}</Badge>)}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Invite dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add people </DialogTitle>
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
                    </DialogHeader>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
                        <Button onClick={() => {
                            const ids = inviteSelected.map((u) => u._id);
                            ChatsAPI.invite(chatId, ids).then(() => {
                                toast.success('Invites sent');
                                setInviteSelected([]); setInviteQuery(''); setInviteOpen(false);
                            }).catch((e) => toast.error(e?.message || 'Failed to invite'));
                        }} disabled={inviteSelected.length === 0} className="gap-2">
                            <UserPlus className="h-4 w-4" /> Invite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Code modal */}
            <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
                <DialogContent className="sm:max-w-[800px] w-[95vw] h-[77vh] flex flex-col">
                    <DialogHeader><DialogTitle>Insert Code Block</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-4 px-1">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Language</label>
                            <select
                                value={codeLang}
                                onChange={(e) => setCodeLang(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                            >
                                {[
                                    'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'go', 'rust', 'cpp', 'c', 'csharp', 'php', 'ruby', 'dart', 'scala',
                                    'clojure', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'sql', 'bash', 'powershell', 'dockerfile', 'markdown', 'latex', 'r', 'matlab', 'haskell', 'elixir'
                                ].map((lang) => <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">Code</label>
                            <Textarea
                                value={codeText}
                                onChange={(e) => setCodeText(e.target.value)}
                                placeholder="Paste or type your code…"
                                className="h-[30vh] font-mono text-sm whitespace-pre resize-none overflow-y-auto"
                                wrap="off"
                            />
                            <div className="rounded-md border p-3 bg-neutral-50 dark:bg-neutral-800/40">
                                {codeText.trim()
                                    ? <RichPostBody raw={`\`\`\`${codeLang}\n${codeText}\n\`\`\``} />
                                    : <p className="text-sm text-neutral-500">Live preview appears here…</p>}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCodeOpen(false)}>Cancel</Button>
                        <Button onClick={insertCode} disabled={!codeText.trim()}>Insert</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* NEW: Confirm Leave */}
            <AlertDialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave this group?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You will no longer receive messages from this group. You can be re-invited later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={leaveGroup}>
                            Leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* NEW: Confirm Delete (DM or Group owner) */}
            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isGroup ? 'Delete this group?' : 'Delete this chat?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isGroup
                                ? 'This will permanently delete the group and all its messages for everyone.'
                                : 'This will permanently delete the conversation and messages for both participants.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteConversation}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
