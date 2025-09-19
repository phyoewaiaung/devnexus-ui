import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/providers/ChatProvider';
import { ChatsAPI } from '@/api/chat';
import { searchUsers } from '@/api/users';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
    MessageSquare, Users, UserPlus, Search, AlertCircle, PlusCircle, ChevronRight,
    Check, X, Loader2, UserCheck, LogIn, MessagesSquare, MessageCircle
} from 'lucide-react';

const nameOf = (u) => u?.name || u?.username || 'Unknown';
const initials = (u) => (nameOf(u).match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase();

const lastMessagePreview = (m) => {
    if (!m) return '';
    if (typeof m === 'string') return m;
    if (typeof m?.text === 'string' && m.text.trim()) return m.text;
    return 'New message';
};

function PresenceDot({ online }) {
    return (
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
    );
}

function ConversationItem({ convo, meId, presenceMap }) {
    const other = useMemo(() => {
        const others = (convo.participants || [])
            .map((p) => p.user)
            .filter((u) => String(u?._id || u) !== String(meId));
        return convo.isGroup ? null : others[0];
    }, [convo, meId]);

    const online = other ? !!presenceMap?.get?.(String(other._id || other)) : false;
    const title = convo.isGroup ? (convo.title || 'Group') : nameOf(other);

    return (
        <Link to={`/chats/${convo._id}`} className="block">
            <Card className="p-3 hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-10 w-10">
                            {convo.isGroup ? (
                                <AvatarFallback>GR</AvatarFallback>
                            ) : other?.avatarUrl ? (
                                <AvatarImage src={other.avatarUrl} alt={nameOf(other)} />
                            ) : (
                                <AvatarFallback>{initials(other)}</AvatarFallback>
                            )}
                        </Avatar>
                        {!convo.isGroup && (
                            <span className="absolute -bottom-0 -right-0">
                                <PresenceDot online={online} />
                            </span>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{title}</p>
                            {convo.isGroup && <Badge variant="secondary" className="text-xs">Group</Badge>}
                        </div>
                        {convo.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate">{lastMessagePreview(convo.lastMessage)}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {convo.unread > 0 && (
                            <Badge className="rounded-full px-2 py-0 text-xs">{convo.unread}</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                </div>
            </Card>
        </Link>
    );
}

function UserRow({ user, selected, onToggle, onDM }) {
    return (
        <div className={`w-full px-3 py-2 rounded-lg hover:bg-accent flex items-center gap-3 ${selected ? 'bg-accent/60' : ''}`}>
            <button onClick={() => onToggle(user)} className="flex-1 flex items-center gap-3 text-left">
                <Avatar className="h-8 w-8">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={nameOf(user)} /> : <AvatarFallback>{initials(user)}</AvatarFallback>}
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{nameOf(user)}</p>
                        {user.username && <span className="text-xs text-muted-foreground truncate">@{user.username}</span>}
                    </div>
                </div>
            </button>
            <div className="ml-2 flex items-center gap-2">
                {selected ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4 text-muted-foreground" />}
                <Button size="icon" variant="ghost" aria-label="Message" onClick={() => onDM(user)}>
                    <MessageCircle className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

export default function ChatsPage() {
    const { user } = useAuth();
    const { presence = new Map() } = useChat() || {};
    const navigate = useNavigate();

    const [tab, setTab] = useState('messages');
    const [filter, setFilter] = useState('all'); // 'all' | 'dm' | 'rooms'
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [conversations, setConversations] = useState([]);
    const [invites, setInvites] = useState([]);

    const [openNew, setOpenNew] = useState(false);
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState([]);
    const [roomTitle, setRoomTitle] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const items = await ChatsAPI.listConversations();
            const meId = user?._id;
            setConversations(items || []);
            setInvites((items || []).filter((c) =>
                c.participants?.some((p) => String(p.user?._id || p.user) === String(meId) && (p.status || 'member') === 'invited')
            ));
        } catch (e) {
            setError(e?.message || 'Failed to load chats');
        } finally {
            setLoading(false);
        }
    }, [user?._id]);

    useEffect(() => { load(); }, [load]);

    // Debounced user search
    useEffect(() => {
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            if (!query) { setResults([]); return; }
            try {
                setSearching(true);
                const { users } = await searchUsers(query, { signal: ctrl.signal });
                setResults(users || []);
            } catch { /* ignore */ }
            finally { setSearching(false); }
        }, 250);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [query]);

    const toggleSelect = (u) => {
        setSelected((prev) => prev.some((x) => String(x._id) === String(u._id))
            ? prev.filter((x) => String(x._id) !== String(u._id))
            : [...prev, u]
        );
    };

    const openDM = async (u) => {
        try {
            const existing = (conversations || []).find((c) => !c.isGroup &&
                (c.participants || []).some((p) => String(p.user?._id || p.user) === String(u._id)));
            if (existing) return navigate(`/chats/${existing._id}`);
            const convo = await ChatsAPI.startDM(u._id); // server dedupes 1:1
            await load();
            navigate(`/chats/${convo._id}`);
        } catch (e) {
            toast.error(e?.message || 'Could not start DM');
        }
    };

    const startChat = async () => {
        try {
            if (selected.length === 0) return;
            if (selected.length === 1) return openDM(selected[0]);
            const conversation = await ChatsAPI.createConversation({
                participantIds: selected.map((u) => u._id),
                title: roomTitle.trim() || 'New Room',
                isGroup: true,
            });
            toast.success('Room created. Invites sent.');
            setOpenNew(false);
            setSelected([]);
            setRoomTitle('');
            await load();
            navigate(`/chats/${conversation._id}`);
        } catch (e) {
            toast.error(e?.message || 'Failed to start');
        }
    };

    const accept = async (id) => {
        try {
            await ChatsAPI.acceptInvite(id);
            toast.success('Joined the room');
            await load();
        } catch (e) {
            toast.error(e?.message || 'Failed to accept');
        }
    };

    const decline = async (id) => {
        try {
            await ChatsAPI.declineInvite(id);
            toast.success('Invitation declined');
            await load();
        } catch (e) {
            toast.error(e?.message || 'Failed to decline');
        }
    };

    const filteredConversations = useMemo(() => {
        if (filter === 'dm') return conversations.filter((c) => !c.isGroup);
        if (filter === 'rooms') return conversations.filter((c) => c.isGroup);
        return conversations;
    }, [conversations, filter]);

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessagesSquare className="h-5 w-5 text-[#3C81D2]" />
                        <h1 className="text-lg font-semibold">Chats</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setOpenNew(true)} className="gap-2"><PlusCircle className="h-4 w-4" /> New</Button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-3 sm:px-4 pb-3">
                    <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" className="pl-9" />
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-3 sm:px-4">
                    <Tabs value={tab} onValueChange={setTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="messages" className="gap-2"><MessageSquare className="h-4 w-4" /> Messages</TabsTrigger>
                            <TabsTrigger value="invites" className="gap-2"><UserPlus className="h-4 w-4" /> Invites</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-3">
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {query && (
                    <Card className="p-2">
                        <div className="flex items-center gap-2 px-2 py-1">
                            <Search className="h-4 w-4" />
                            <p className="text-sm text-muted-foreground">Search results</p>
                            {searching && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto" />}
                        </div>
                        <Separator className="my-2" />
                        <div className="max-h-72 overflow-auto">
                            {results.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-3 py-6 text-center">No matches</p>
                            ) : (
                                results.map((u) => (
                                    <div key={u._id} className="px-1">
                                        <UserRow
                                            user={u}
                                            selected={selected.some((x) => String(x._id) === String(u._id))}
                                            onToggle={toggleSelect}
                                            onDM={openDM}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                        {selected.length > 0 && (
                            <div className="flex items-center justify-between pt-2">
                                <div className="text-sm text-muted-foreground px-2">Selected: {selected.length}</div>
                                <Button size="sm" className="gap-2" onClick={() => setOpenNew(true)}>
                                    <PlusCircle className="h-4 w-4" /> Start
                                </Button>
                            </div>
                        )}
                    </Card>
                )}

                {tab === 'messages' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
                            <Button size="sm" variant={filter === 'dm' ? 'default' : 'outline'} onClick={() => setFilter('dm')}>Direct</Button>
                            <Button size="sm" variant={filter === 'rooms' ? 'default' : 'outline'} onClick={() => setFilter('rooms')}>Rooms</Button>
                        </div>

                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <Card key={i} className="p-3 animate-pulse">
                                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                                    <div className="h-3 bg-muted rounded w-2/3" />
                                </Card>
                            ))
                        ) : filteredConversations.length === 0 ? (
                            <Card className="p-6 text-center">
                                <Users className="h-6 w-6 mx-auto text-[#3C81D2]" />
                                <p className="mt-2 text-sm text-muted-foreground">No conversations yet.</p>
                                <Button className="mt-3" onClick={() => setOpenNew(true)}>Start a chat</Button>
                            </Card>
                        ) : (
                            filteredConversations.map((c) => (
                                <ConversationItem key={c._id} convo={c} meId={user?._id} presenceMap={presence} />
                            ))
                        )}
                    </div>
                )}

                {tab === 'invites' && (
                    <div className="space-y-2">
                        {invites.length === 0 ? (
                            <Card className="p-6 text-center">
                                <UserCheck className="h-6 w-6 mx-auto text-[#3C81D2]" />
                                <p className="mt-2 text-sm text-muted-foreground">No pending invitations.</p>
                            </Card>
                        ) : (
                            invites.map((c) => (
                                <Card key={c._id} className="p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{c.title || 'Chat invitation'}</p>
                                            <p className="text-xs text-muted-foreground">{c.participants?.length || 0} participants</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="outline" onClick={() => navigate(`/chats/${c._id}`)} className="gap-1">
                                                <LogIn className="h-4 w-4" /> View
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={async () => { await accept(c._id); }} className="gap-1">
                                                <Check className="h-4 w-4" /> Accept
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={async () => { await decline(c._id); }} className="gap-1 text-destructive">
                                                <X className="h-4 w-4" /> Decline
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                )}
            </div>

            <Dialog open={openNew} onOpenChange={setOpenNew}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{selected.length > 1 ? 'Create room' : 'Start a DM'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3">
                        {selected.length > 1 && (
                            <div>
                                <label className="text-sm font-medium">Room title</label>
                                <Input
                                    value={roomTitle}
                                    onChange={(e) => setRoomTitle(e.target.value)}
                                    placeholder="Team sync, Weekend plan…"
                                    className="mt-2"
                                />
                            </div>
                        )}
                        <div>
                            <label className="text-sm font-medium">Participants</label>
                            <div className="mt-2 max-h-56 overflow-auto rounded-lg border">
                                {selected.length === 0 && (
                                    <p className="text-sm text-muted-foreground p-3">Use the search above to add people.</p>
                                )}
                                {selected.map((u) => (
                                    <div key={u._id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Avatar className="h-7 w-7">
                                                {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={nameOf(u)} /> : <AvatarFallback>{initials(u)}</AvatarFallback>}
                                            </Avatar>
                                            <span className="truncate">{nameOf(u)}</span>
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => setSelected((prev) => prev.filter((x) => String(x._id) !== String(u._id)))} className="text-destructive">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancel</Button>
                        <Button onClick={startChat} disabled={selected.length === 0} className="gap-2">
                            <PlusCircle className="h-4 w-4" /> {selected.length > 1 ? 'Create room' : 'Start DM'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
