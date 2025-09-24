// src/pages/ChatsPage.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/providers/ChatProvider';
import { ChatsAPI } from '@/api/chat';
import { searchUsers } from '@/api/users';
import { useNotifications } from '@/providers/NotificationsProvider';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
    MessageSquare,
    Users,
    UserPlus,
    Search as SearchIcon,
    AlertCircle,
    PlusCircle,
    ChevronRight,
    Check,
    X,
    Loader2,
    MessageCircle,
    CornerDownLeft,
    ArrowUp,
    ArrowDown,
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
    return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />;
}

function ConversationItem({ convo, meId, isOnline }) {
    const other = useMemo(() => {
        const others = (convo.participants || [])
            .map((p) => p.user)
            .filter((u) => String(u?._id || u) !== String(meId));
        return convo.isGroup ? null : others[0];
    }, [convo, meId]);

    const online = useMemo(() => {
        const otherId = other?._id || other;
        return typeof isOnline === 'function' && otherId ? !!isOnline(String(otherId)) : false;
    }, [isOnline, other]);

    const title = convo.isGroup ? (convo.title || 'Group') : nameOf(other);

    return (
        <Link to={`/chats/${convo._id}`} className="block">
            <Card className="p-3 sm:p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                            {convo.isGroup ? (
                                <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                    GR
                                </AvatarFallback>
                            ) : other?.avatarUrl ? (
                                <AvatarImage src={other.avatarUrl} alt={nameOf(other)} />
                            ) : (
                                <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-indigo-500 to-pink-500 text-white">
                                    {initials(other)}
                                </AvatarFallback>
                            )}
                        </Avatar>
                        {!convo.isGroup && (
                            <span className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
                                <PresenceDot online={online} />
                            </span>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-foreground truncate text-sm sm:text-base">{title}</p>
                            {convo.isGroup && <Badge variant="secondary" className="text-xs px-2 py-0.5">Group</Badge>}
                        </div>
                        {convo.lastMessage && (
                            <p className="text-xs sm:text-sm text-muted-foreground truncate leading-relaxed">
                                {lastMessagePreview(convo.lastMessage)}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {convo.unread > 0 && (
                            <Badge className="rounded-full px-2 py-0.5 text-xs min-w-[20px] h-5 flex items-center justify-center bg-blue-600 hover:bg-blue-700">
                                {convo.unread > 99 ? '99+' : convo.unread}
                            </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                </div>
            </Card>
        </Link>
    );
}

/**
 * User row
 * mode:
 *  - 'open': clicking row opens DM immediately
 *  - 'select': clicking toggles selection (for group builder)
 */
function UserRow({ user, highlighted, mode = 'open', selected, onOpen, onToggle }) {
    const handleClick = () => {
        if (mode === 'select') onToggle?.(user);
        else onOpen?.(user);
    };
    return (
        <div
            className={`w-full px-3 py-2.5 rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${highlighted ? 'bg-accent/70' : 'hover:bg-accent'
                } ${selected ? 'ring-2 ring-blue-500/50 bg-blue-50 dark:bg-blue-950/30' : ''}`}
            role="option"
            aria-selected={highlighted}
            onClick={handleClick}
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-9 w-9 flex-shrink-0">
                    {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={nameOf(user)} />
                    ) : (
                        <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-500 text-white text-sm font-semibold">
                            {initials(user)}
                        </AvatarFallback>
                    )}
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-sm">{nameOf(user)}</p>
                        {user.username && (
                            <span className="text-xs text-muted-foreground truncate">@{user.username}</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                {mode === 'select' ? (
                    selected ? (
                        <div className="bg-blue-600 rounded-full p-1">
                            <Check className="h-3 w-3 text-white" />
                        </div>
                    ) : (
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                    )
                ) : (
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                )}
            </div>
        </div>
    );
}

export default function ChatsPage() {
    const { user } = useAuth();
    useChat(); // keep socket wiring alive if needed elsewhere
    const navigate = useNavigate();
    const { isOnline, items: notifItems } = useNotifications();

    const [tab, setTab] = useState('messages');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [conversations, setConversations] = useState([]);
    const [invites, setInvites] = useState([]);

    // Header people search (users only) — opens DM directly
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const listRef = useRef(null);

    // New Chat dialog (two tabs)
    const [openNew, setOpenNew] = useState(false);
    const [dialogTab, setDialogTab] = useState('direct');

    // Direct tab
    const [dmQuery, setDmQuery] = useState('');
    const [dmSearching, setDmSearching] = useState(false);
    const [dmResults, setDmResults] = useState([]);
    const [initialDMMessage, setInitialDMMessage] = useState('');

    // Group tab
    const [groupQuery, setGroupQuery] = useState('');
    const [groupSearching, setGroupSearching] = useState(false);
    const [groupResults, setGroupResults] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState([]);
    const [roomTitle, setRoomTitle] = useState('');
    const [inviteMessage, setInviteMessage] = useState('');

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

    // reflect invites quickly
    const lastInviteIdRef = useRef(null);
    useEffect(() => {
        if (!Array.isArray(notifItems)) return;
        const latestInvite = notifItems.find((n) => n.type === 'chat:invite');
        if (!latestInvite) return;
        const candidate = String(latestInvite.conversation || '');
        if (candidate && lastInviteIdRef.current !== candidate) {
            lastInviteIdRef.current = candidate;
            load();
        }
    }, [notifItems, load]);

    // MAIN: Debounced user search
    useEffect(() => {
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            if (!query?.trim()) { setResults([]); setHighlightIndex(0); return; }
            try {
                setSearching(true);
                const { users } = await searchUsers(query.trim(), { signal: ctrl.signal });
                setResults(users || []);
                setHighlightIndex(0);
            } catch { /* ignore */ }
            finally { setSearching(false); }
        }, 250);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [query]);

    // DIALOG: Direct tab search
    useEffect(() => {
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            if (!dmQuery?.trim()) { setDmResults([]); return; }
            try {
                setDmSearching(true);
                const { users } = await searchUsers(dmQuery.trim(), { signal: ctrl.signal });
                setDmResults(users || []);
            } catch { /* ignore */ }
            finally { setDmSearching(false); }
        }, 250);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [dmQuery]);

    // DIALOG: Group tab search
    useEffect(() => {
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            if (!groupQuery?.trim()) { setGroupResults([]); return; }
            try {
                setGroupSearching(true);
                const { users } = await searchUsers(groupQuery.trim(), { signal: ctrl.signal });
                setGroupResults(users || []);
            } catch { /* ignore */ }
            finally { setGroupSearching(false); }
        }, 250);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [groupQuery]);

    const openDM = async (u) => {
        try {
            const existing = (conversations || []).find(
                (c) => !c.isGroup && (c.participants || []).some((p) => String(p.user?._id || p.user) === String(u._id))
            );
            if (existing) return navigate(`/chats/${existing._id}`);

            const convo = await ChatsAPI.startDM(u._id, { initialMessage: initialDMMessage?.trim() || '' });
            await load();
            navigate(`/chats/${convo._id}`);
        } catch (e) {
            toast.error(e?.message || 'Could not start DM');
        }
    };

    const toggleGroupSelect = (u) => {
        setSelectedGroup((prev) =>
            prev.some((x) => String(x._id) === String(u._id))
                ? prev.filter((x) => String(x._id) !== String(u._id))
                : [...prev, u]
        );
    };

    const createGroup = async () => {
        try {
            if (selectedGroup.length < 2) {
                toast.error('Select at least 2 participants for a group');
                return;
            }
            const conversation = await ChatsAPI.createConversation({
                title: roomTitle.trim() || 'New Room',
                isGroup: true,
                participantIds: [],
            });
            await ChatsAPI.invite(
                conversation._id,
                selectedGroup.map((u) => u._id),
                inviteMessage?.trim() || undefined
            );
            toast.success('Group created. Invites sent.');
            setOpenNew(false);
            setSelectedGroup([]);
            setRoomTitle('');
            setInviteMessage('');
            await load();
            navigate(`/chats/${conversation._id}`);
        } catch (e) {
            toast.error(e?.message || 'Failed to create group');
        }
    };

    const accept = async (id) => {
        try {
            await ChatsAPI.acceptInvite(id);
            toast.success('Joined the room');
            await load();
        } catch (e) { toast.error(e?.message || 'Failed to accept'); }
    };

    const decline = async (id) => {
        try {
            await ChatsAPI.declineInvite(id);
            toast.success('Invitation declined');
            await load();
        } catch (e) { toast.error(e?.message || 'Failed to decline'); }
    };

    const filteredConversations = useMemo(() => {
        if (filter === 'dm') return conversations.filter((c) => !c.isGroup);
        if (filter === 'rooms') return conversations.filter((c) => c.isGroup);
        return conversations;
    }, [conversations, filter]);

    // Keyboard navigation for MAIN results
    const onKeyDownSearch = (e) => {
        if (!results?.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
            listRef.current?.querySelectorAll('[role="option"]')[
                Math.min(highlightIndex + 1, results.length - 1)
            ]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
            listRef.current?.querySelectorAll('[role="option"]')[
                Math.max(highlightIndex - 1, 0)
            ]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const u = results[highlightIndex];
            if (u) openDM(u);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 shadow-sm">
                {/* Main Header */}
                <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
                            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-foreground">Chats</h1>
                            <p className="text-xs text-muted-foreground hidden sm:block">Stay connected with your team</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => { setOpenNew(true); setDialogTab('direct'); }}
                            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                            size="sm"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">New Chat</span>
                            <span className="sm:hidden">New</span>
                        </Button>
                    </div>
                </div>

                {/* Sticky Search Section */}
                <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4">
                    <div className="relative">
                        <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onKeyDownSearch}
                            placeholder="Search people to start a conversation..."
                            className="pl-10 h-10 sm:h-11 bg-muted/50 border-0 focus:bg-background transition-colors"
                            aria-autocomplete="list"
                            aria-expanded={!!query}
                        />
                        {searching && (
                            <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                    </div>
                </div>

                {/* Sticky Tabs */}
                <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6">
                    <Tabs value={tab} onValueChange={setTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1">
                            <TabsTrigger value="messages" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <MessageSquare className="h-4 w-4" />
                                <span className="hidden sm:inline">Messages</span>
                                <span className="sm:hidden">Chats</span>
                                {filteredConversations.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                        {filteredConversations.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="invites" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <UserPlus className="h-4 w-4" />
                                <span className="hidden sm:inline">Invites</span>
                                <span className="sm:hidden">Invites</span>
                                {invites.length > 0 && (
                                    <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">
                                        {invites.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
                {error && (
                    <Alert variant="destructive" className="shadow-sm">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* MAIN search results - Enhanced */}
                {query && (
                    <Card className="p-2 sm:p-3 shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
                        <div className="flex items-center gap-2 px-2 py-1.5">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-blue-500">
                                <SearchIcon className="h-3 w-3 text-white" />
                            </div>
                            <p className="text-sm font-medium text-foreground">People</p>
                            {searching && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto text-blue-600" />}
                        </div>
                        <Separator className="my-2" />
                        <div className="max-h-80 overflow-auto" ref={listRef} role="listbox">
                            {results.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                                        <SearchIcon className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">No people found</p>
                                    <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {results.map((u, idx) => (
                                        <div key={u._id} className="px-1">
                                            <UserRow
                                                user={u}
                                                highlighted={idx === highlightIndex}
                                                mode="open"
                                                onOpen={openDM}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 pt-3 border-t mt-3">
                            <div className="flex items-center gap-1">
                                <ArrowUp className="h-3 w-3" />
                                <ArrowDown className="h-3 w-3" />
                                <span>navigate</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                                <CornerDownLeft className="h-3 w-3" />
                                <span>select</span>
                            </div>
                        </div>
                    </Card>
                )}

                {tab === 'messages' && (
                    <div className="space-y-4 sm:space-y-6">
                        {/* Enhanced Filter Buttons */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            <Button
                                size="sm"
                                variant={filter === 'all' ? 'default' : 'outline'}
                                onClick={() => setFilter('all')}
                                className={filter === 'all' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : ''}
                            >
                                All
                                <Badge variant="secondary" className="ml-2 text-xs">
                                    {conversations.length}
                                </Badge>
                            </Button>
                            <Button
                                size="sm"
                                variant={filter === 'dm' ? 'default' : 'outline'}
                                onClick={() => setFilter('dm')}
                                className={filter === 'dm' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : ''}
                            >
                                Direct
                                <Badge variant="secondary" className="ml-2 text-xs">
                                    {conversations.filter(c => !c.isGroup).length}
                                </Badge>
                            </Button>
                            <Button
                                size="sm"
                                variant={filter === 'rooms' ? 'default' : 'outline'}
                                onClick={() => setFilter('rooms')}
                                className={filter === 'rooms' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : ''}
                            >
                                Rooms
                                <Badge variant="secondary" className="ml-2 text-xs">
                                    {conversations.filter(c => c.isGroup).length}
                                </Badge>
                            </Button>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Card key={i} className="p-3 sm:p-4 animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-full flex-shrink-0" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 bg-muted rounded w-1/3" />
                                                <div className="h-3 bg-muted rounded w-2/3" />
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <Card className="p-8 sm:p-12 text-center shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                    <Users className="h-8 w-8 text-white" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
                                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                                    Start connecting with your team by creating a new chat or joining a room.
                                </p>
                                <Button
                                    onClick={() => setOpenNew(true)}
                                    className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                                >
                                    <PlusCircle className="h-4 w-4" /> Start a chat
                                </Button>
                            </Card>
                        ) : (
                            <div className="space-y-2 sm:space-y-3">
                                {filteredConversations.map((c) => (
                                    <ConversationItem key={c._id} convo={c} meId={user?._id} isOnline={isOnline} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'invites' && (
                    <div className="space-y-3 sm:space-y-4">
                        {invites.length === 0 ? (
                            <Card className="p-8 sm:p-12 text-center shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                                    <UserPlus className="h-8 w-8 text-white" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">No pending invitations</h3>
                                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                    You're all caught up! New chat invitations will appear here.
                                </p>
                            </Card>
                        ) : (
                            invites.map((c) => (
                                <Card key={c._id} className="p-4 sm:p-5 shadow-md border-0 bg-gradient-to-r from-background to-muted/10">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                                <Users className="h-6 w-6 text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                                                    {c.title || 'Chat invitation'}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                        {c.participants?.length || 0} participants
                                                    </p>
                                                    <Badge variant="outline" className="text-xs px-2 py-0">
                                                        Pending
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => navigate(`/chats/${c._id}`)}
                                                className="gap-1"
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={async () => { await accept(c._id); }}
                                                className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                                            >
                                                <Check className="h-4 w-4" /> Accept
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={async () => { await decline(c._id); }}
                                                className="gap-1 text-destructive hover:bg-destructive/10"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Enhanced New Chat Dialog */}
            <Dialog open={openNew} onOpenChange={setOpenNew}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Start a new chat
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Connect with individuals or create group conversations
                        </p>
                    </DialogHeader>

                    <Tabs value={dialogTab} onValueChange={setDialogTab} className="flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 mb-4">
                            <TabsTrigger value="direct" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Direct Message
                            </TabsTrigger>
                            <TabsTrigger value="group" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                <Users className="h-4 w-4 mr-2" />
                                Group Chat
                            </TabsTrigger>
                        </TabsList>

                        {/* DIRECT TAB - Enhanced */}
                        <TabsContent value="direct" className="space-y-2 flex-1 flex flex-col">
                            <div>
                                <label className="text-sm font-semibold text-foreground block mb-2">
                                    Find people to message
                                </label>
                                <div className="relative">
                                    <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                                    <Input
                                        value={dmQuery}
                                        onChange={(e) => setDmQuery(e.target.value)}
                                        placeholder="Type a name or username..."
                                        className="pl-10 h-11 bg-muted/50 border-0 focus:bg-background"
                                    />
                                    {dmSearching && (
                                        <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600" />
                                    )}
                                </div>
                            </div>

                            <Card className="p-3 flex-1 min-h-0 bg-gradient-to-br from-background to-muted/10">
                                <div className="flex items-center gap-2 px-2 py-1.5 mb-3">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
                                        <Users className="h-3 w-3 text-white" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground">Available People</p>
                                    {dmSearching && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto text-blue-600" />}
                                </div>
                                <Separator className="mb-3" />
                                <div className="max-h-80 overflow-auto">
                                    {dmResults.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                                                <SearchIcon className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {dmQuery ? 'No people found' : 'Start typing to search for people'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {dmResults.map((u) => (
                                                <div key={u._id} className="px-1">
                                                    <UserRow user={u} mode="open" onOpen={openDM} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <DialogFooter className="flex-shrink-0">
                                <Button variant="ghost" onClick={() => setOpenNew(false)}>Close</Button>
                            </DialogFooter>
                        </TabsContent>

                        {/* GROUP TAB - Enhanced */}
                        <TabsContent value="group" className="space-y-2 flex-1 flex flex-col">
                            <div>
                                <label className="text-sm font-semibold text-foreground block mb-2">
                                    Group name
                                </label>
                                <Input
                                    value={roomTitle}
                                    onChange={(e) => setRoomTitle(e.target.value)}
                                    placeholder="Team sync, Weekend plan, Project discussion..."
                                    className="h-11 bg-muted/50 border-0 focus:bg-background"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-foreground block mb-2">
                                    Add participants
                                </label>
                                <div className="relative">
                                    <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                                    <Input
                                        value={groupQuery}
                                        onChange={(e) => setGroupQuery(e.target.value)}
                                        placeholder="Search for people to add..."
                                        className="pl-10 h-11 bg-muted/50 border-0 focus:bg-background"
                                    />
                                    {groupSearching && (
                                        <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600" />
                                    )}
                                </div>
                            </div>

                            <Card className=" p-3 bg-gradient-to-br from-background to-muted/10 gap-2">
                                <div className="flex items-center gap-2 px-2">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-blue-500">
                                        <Users className="h-3 w-3 text-white" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground">People</p>
                                    {groupSearching && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto text-blue-600" />}
                                </div>
                                <Separator className="mb-1" />
                                <div className="max-h-20 min-h-20 overflow-auto">
                                    {groupResults.length === 0 ? (
                                        <div className="text-center pb-3">
                                            <div className="w-7 h-7 mx-auto mb-2 rounded-full bg-muted/50 flex items-center justify-center">
                                                <SearchIcon className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {groupQuery ? 'No people found' : 'Search to add people'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {groupResults.map((u) => (
                                                <div key={u._id} className="px-1">
                                                    <UserRow
                                                        user={u}
                                                        mode="select"
                                                        selected={selectedGroup.some((x) => String(x._id) === String(u._id))}
                                                        onToggle={toggleGroupSelect}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-foreground">
                                        Selected participants
                                    </label>
                                    <Badge variant="outline" className="text-xs">
                                        {selectedGroup.length} selected
                                    </Badge>
                                </div>
                                <Card className="max-h-30 min-h-30 overflow-auto bg-muted/20 py-2">
                                    {selectedGroup.length === 0 ? (
                                        <div className="text-center">
                                            <div className="w-7 h-7 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">No participants selected yet</p>
                                        </div>
                                    ) : (
                                        <div className=" px-2 flex flex-wrap gap-2 items-start">
                                            {selectedGroup.map((u) => (
                                                <div key={u._id} className="flex w-fit items-center justify-between px-3 py-2 bg-background rounded-lg shadow-sm">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Avatar className="h-7 w-7 flex-shrink-0">
                                                            {u.avatarUrl ? (
                                                                <AvatarImage src={u.avatarUrl} alt={nameOf(u)} />
                                                            ) : (
                                                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                                                                    {initials(u)}
                                                                </AvatarFallback>
                                                            )}
                                                        </Avatar>
                                                        <span className="truncate text-sm font-medium">{nameOf(u)}</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setSelectedGroup((prev) => prev.filter((x) => String(x._id) !== String(u._id)))}
                                                        className="text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-foreground block mb-2">
                                    Invitation message (optional)
                                </label>
                                <textarea
                                    value={inviteMessage}
                                    onChange={(e) => setInviteMessage(e.target.value)}
                                    placeholder="Add context about the group or say hello..."
                                    className="w-full rounded-lg border bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-background resize-none transition-colors"
                                    rows={3}
                                />
                            </div>

                            <DialogFooter className="flex-shrink-0 gap-2">
                                <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancel</Button>
                                <Button
                                    onClick={createGroup}
                                    disabled={selectedGroup.length < 2}
                                    className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    Create group ({selectedGroup.length})
                                </Button>
                            </DialogFooter>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
    );
}