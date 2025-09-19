// src/pages/ConversationPage.jsx
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Send, Paperclip, Users2, UserPlus, Loader2, Search as SearchIcon } from 'lucide-react';

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

function PresenceDot({ online }) {
    return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />;
}

function Bubble({ mine, msg, author, showAuthor }) {
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'} px-2`}>
            {!mine && (
                <Avatar className="h-7 w-7 mr-2 mt-5 shrink-0">
                    {author?.avatarUrl ? <AvatarImage src={author.avatarUrl} alt={author?.name || author?.username || 'User'} /> :
                        <AvatarFallback>{(author?.name || author?.username || '?').slice(0, 2).toUpperCase()}</AvatarFallback>}
                </Avatar>
            )}
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${mine ? 'bg-[#3C81D2] text-white' : 'bg-muted'}`}>
                {showAuthor && !mine && (
                    <div className="text-xs font-medium mb-0.5 text-foreground/80">{nameOf(author)}</div>
                )}
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

export default function ConversationPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { messages: messagesMap, setMessages, send, indicateTyping, markRead, presence, typing } = useChat() || {};

    const [conversation, setConversation] = useState(null);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [invited, setInvited] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [membersOpen, setMembersOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteQuery, setInviteQuery] = useState('');
    const [inviteResults, setInviteResults] = useState([]);
    const [inviteSearching, setInviteSearching] = useState(false);
    const [inviteSelected, setInviteSelected] = useState([]);

    const typingTimer = useRef(null);
    const bottomRef = useRef(null);

    const messages = useMemo(() => (messagesMap?.get ? messagesMap.get(String(id)) || [] : []), [messagesMap, id]);
    const participants = conversation?.participants || [];
    const otherUsers = useMemo(
        () => participants.filter((p) => String(p.user?._id || p.user) !== String(user?._id)).map((p) => p.user),
        [participants, user?._id]
    );

    const isGroup = !!conversation?.isGroup;
    const title = isGroup ? (conversation?.title || 'Group') : (otherUsers[0]?.name || otherUsers[0]?.username || 'Conversation');

    const fetchConversation = useCallback(async () => {
        try {
            setLoading(true);
            const convo = await ChatsAPI.getConversation(id);
            setConversation(convo);
            const meP = (convo.participants || []).find((p) => String(p.user?._id || p.user) === String(user?._id));
            setInvited((meP?.status || 'member') === 'invited');
        } catch (e) {
            toast.error(e?.message || 'Failed to load conversation');
        } finally {
            setLoading(false);
        }
    }, [id, user?._id]);

    const loadInitial = useCallback(async () => {
        try {
            const { messages: batch, nextCursor: cursor } = await ChatsAPI.listMessages(id, { limit: 30 });
            // If invitee (403), listMessages throws — we catch below
            setMessages?.((prev) => new Map(prev).set(String(id), (batch || []).reverse()));
            setNextCursor(cursor || null);
            if (batch?.length) markRead?.(id);
        } catch (e) {
            // Invitee will get 403 here — show banner via `invited` state
            // (fetchConversation already set invited)
        }
    }, [id, setMessages, markRead]);

    useEffect(() => { fetchConversation(); }, [fetchConversation]);
    useEffect(() => { loadInitial(); }, [loadInitial]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages.length]);

    const onTextChange = (v) => {
        setText(v);
        try {
            if (typingTimer.current) clearTimeout(typingTimer.current);
            indicateTyping?.(id, true);
            typingTimer.current = setTimeout(() => indicateTyping?.(id, false), 1500);
        } catch { }
    };

    const sendNow = async () => {
        const t = text.trim();
        if (!t || invited) return;
        try {
            await send?.(id, { text: t });
            setText('');
        } catch (e) {
            toast.error(e?.message || 'Failed to send');
        }
    };

    const accept = async () => {
        try {
            await ChatsAPI.acceptInvite(id);
            await fetchConversation();
            await loadInitial();
            toast.success('Joined the room');
        } catch (e) {
            toast.error(e?.message || 'Failed to accept');
        }
    };

    const decline = async () => {
        try {
            await ChatsAPI.declineInvite(id);
            toast.success('Invitation declined');
            navigate('/chats');
        } catch (e) {
            toast.error(e?.message || 'Failed to decline');
        }
    };

    const loadOlder = async () => {
        if (!nextCursor || loadingMore || invited) return;
        try {
            setLoadingMore(true);
            const { messages: batch, nextCursor: cursor } = await ChatsAPI.listMessages(id, { cursor: nextCursor, limit: 30 });
            setMessages?.((prev) => {
                const current = prev.get(String(id)) || [];
                return new Map(prev).set(String(id), [...(batch || []).reverse(), ...current]);
            });
            setNextCursor(cursor || null);
        } catch (e) {
            toast.error(e?.message || 'Failed to load earlier');
        } finally {
            setLoadingMore(false);
        }
    };

    // Invite search (excludes existing members)
    const memberIds = useMemo(() => new Set((participants || []).map((p) => String(p.user?._id || p.user))), [participants]);

    useEffect(() => {
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            if (!inviteOpen || !inviteQuery) { setInviteResults([]); return; }
            try {
                setInviteSearching(true);
                const { users } = await searchUsers(inviteQuery, { signal: ctrl.signal });
                const filtered = (users || []).filter((u) => !memberIds.has(String(u._id)));
                setInviteResults(filtered);
            } catch { }
            finally { setInviteSearching(false); }
        }, 250);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [inviteOpen, inviteQuery, memberIds]);

    const inviteToggle = (u) => {
        setInviteSelected((prev) => prev.some((x) => String(x._id) === String(u._id))
            ? prev.filter((x) => String(x._id) !== String(u._id))
            : [...prev, u]
        );
    };

    const sendInvites = async () => {
        try {
            if (!inviteSelected.length) return;
            await ChatsAPI.invite(id, inviteSelected.map((u) => u._id));
            toast.success('Invites sent');
            setInviteSelected([]);
            setInviteQuery('');
            setInviteOpen(false);
        } catch (e) {
            toast.error(e?.message || 'Failed to invite');
        }
    };

    // grouped messages
    const listWithDividers = useMemo(() => {
        const out = [];
        let prev = null;
        for (const m of messages) {
            const needsDivider = !prev || !isSameDay(prev.createdAt, m.createdAt);
            if (needsDivider) out.push({ _type: 'divider', when: m.createdAt, _id: `d-${m._id || m.clientMsgId}` });

            const mine = String(m.sender?._id || m.sender) === String(user?._id);
            const sameAuthorAsPrev = prev && String(prev.sender?._id || prev.sender) === String(m.sender?._id || m.sender) && isSameDay(prev.createdAt, m.createdAt);
            const showAuthor = isGroup && !mine && !sameAuthorAsPrev;

            out.push({ _type: 'msg', msg: m, mine, showAuthor });
            prev = m;
        }
        return out;
    }, [messages, user?._id, isGroup]);

    const typingSet = typing?.get ? typing.get(String(id)) : new Set();
    const isSomeoneTyping = typingSet && typingSet.size > 0;

    // presence for DM
    const dmOnline = !isGroup && otherUsers[0]?._id && presence?.get?.(String(otherUsers[0]._id));

    return (
        <div className="h-[85vh] max-h-[85vh] overflow-hidden bg-background flex flex-col">
            {/* Header */}
            <div className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-3">
                    <Link to="/chats"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>

                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            {isGroup
                                ? <AvatarFallback>{(title || 'G').slice(0, 2).toUpperCase()}</AvatarFallback>
                                : (otherUsers[0]?.avatarUrl
                                    ? <AvatarImage src={otherUsers[0].avatarUrl} alt={title} />
                                    : <AvatarFallback>{(title || 'C').slice(0, 2).toUpperCase()}</AvatarFallback>
                                )
                            }
                        </Avatar>
                        <div>
                            <div className="font-semibold leading-none flex items-center gap-2">
                                {title}
                                {isGroup && <Badge variant="secondary">Group</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <Users2 className="h-3.5 w-3.5" /> {participants.length || 1}
                                {!isGroup && otherUsers[0]?._id && (
                                    <>
                                        • <PresenceDot online={!!dmOnline} /> {dmOnline ? 'Online' : 'Offline'}
                                    </>
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
                    <div className="h-[calc(100svh-56px-92px)] sm:h-[calc(100svh-56px-112px)] overflow-y-auto p-2 sm:p-4">
                        {invited && (
                            <div className="text-center mb-3 text-sm text-muted-foreground">
                                You’ve been invited to this room. Accept to view and send messages.
                            </div>
                        )}

                        {!invited && (
                            <>
                                {nextCursor && (
                                    <div className="text-center mb-1">
                                        <Button size="sm" variant="ghost" onClick={loadOlder} disabled={loadingMore}>
                                            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load earlier messages'}
                                        </Button>
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
                                                author={row.mine ? user : otherUsers.find(o => String(o._id || o) === String(row.msg.sender?._id || row.msg.sender))}
                                                showAuthor={row.showAuthor}
                                            />
                                        </div>
                                    )
                                )}
                            </>
                        )}

                        <div ref={bottomRef} />
                    </div>
                </Card>
            </div>

            {/* Composer */}
            <div className="sticky bottom-0 z-10 bg-background border-t">
                <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2">
                    <Card className="p-2 sm:p-3">
                        <div className="flex items-end gap-2">
                            <Button variant="outline" size="icon" className="shrink-0" disabled><Paperclip className="h-4 w-4" /></Button>
                            <Textarea
                                value={text}
                                onChange={(e) => onTextChange(e.target.value)}
                                placeholder={invited ? 'Accept the invite to send messages…' : 'Write a message…'}
                                className="min-h-[44px] max-h-40"
                                disabled={invited}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNow(); }
                                }}
                            />
                            <Button onClick={sendNow} className="shrink-0" disabled={!text.trim() || invited}>
                                <Send className="h-4 w-4 mr-1" /> Send
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Members sheet */}
            <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Members</SheetTitle>
                        <SheetDescription>{participants.length} people</SheetDescription>
                    </SheetHeader>

                    <div className="mt-4 space-y-2">
                        {(participants || []).map((p) => {
                            const u = p.user || {};
                            const isMe = String(u._id) === String(user?._id);
                            return (
                                <div key={String(u._id)} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-accent/40">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar className="h-8 w-8">
                                            {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={nameOf(u)} /> : <AvatarFallback>{initials(u)}</AvatarFallback>}
                                        </Avatar>
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">{nameOf(u)} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {p.role || 'member'} • {p.status || 'member'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Invite dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add people</DialogTitle>
                    </DialogHeader>

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
                                        onClick={() => inviteToggle(u)}
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
