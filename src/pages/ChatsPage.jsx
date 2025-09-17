import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    MessageSquarePlus,
    Users,
    Archive,
    MoreVertical,
    Pin,
    Check,
    CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatsPage() {
    const { user: me } = useAuth();
    const { conversations, presence } = useChat();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");

    // Helper to read presence for a userId from Map or object
    const isUserOnline = (userId) => {
        if (!userId || !presence) return false;
        const keyStr = String(userId);

        let val;
        if (presence?.get) {
            // Map
            val = presence.get(keyStr);
            if (val === undefined) val = presence.get(userId);
        } else {
            // Plain object
            val = presence[keyStr] ?? presence[userId];
        }

        if (typeof val === "boolean") return val;
        if (val && typeof val === "object") {
            if ("online" in val) return !!val.online;
            if ("status" in val) return String(val.status).toLowerCase() === "online";
        }
        return Boolean(val);
    };

    // All unique participant IDs across conversations (exclude me)
    const conversationUserIds = useMemo(() => {
        const ids = new Set();
        (conversations || []).forEach((c) => {
            (c.participants || []).forEach((p) => {
                const id = p?.user?._id;
                if (id && String(id) !== String(me?._id)) ids.add(String(id));
            });
        });
        return ids;
    }, [conversations, me?._id]);

    // Online count limited to users who are in your conversations
    const onlineCount = useMemo(() => {
        let count = 0;
        conversationUserIds.forEach((id) => {
            if (isUserOnline(id)) count += 1;
        });
        return count;
    }, [conversationUserIds, presence]);

    // Filter conversations based on search
    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return conversations || [];
        return (conversations || []).filter((c) => {
            const others =
                c.participants?.filter((p) => p.user && !p.user.isSelf) || [];
            const title = c.isGroup
                ? c.title || "Group"
                : others.map((p) => p.user?.name || p.user?.username).join(", ");
            return (
                title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.lastMessage?.text
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase())
            );
        });
    }, [conversations, searchQuery]);

    // Sort conversations by last activity
    const sortedConversations = useMemo(() => {
        return [...filteredConversations].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const aTime = new Date(a.lastMessage?.createdAt || a.updatedAt || 0);
            const bTime = new Date(b.lastMessage?.createdAt || b.updatedAt || 0);
            return bTime - aTime;
        });
    }, [filteredConversations]);

    const formatLastSeen = (date) => {
        if (!date) return "";
        const now = new Date();
        const messageDate = new Date(date);
        const diffInMinutes = Math.floor((now - messageDate) / (1000 * 60));
        if (diffInMinutes < 1) return "now";
        if (diffInMinutes < 60) return `${diffInMinutes}m`;
        if (diffInMinutes < 24 * 60) return `${Math.floor(diffInMinutes / 60)}h`;
        if (diffInMinutes < 7 * 24 * 60)
            return `${Math.floor(diffInMinutes / (24 * 60))}d`;
        return messageDate.toLocaleDateString();
    };

    const truncateMessage = (text, maxLength = 50) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Chats</h1>
                {/* <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="rounded-full">
                        <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="default"
                        size="icon"
                        className="rounded-full"
                        onClick={() => navigate("/chats/new")}
                    >
                        <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                </div> */}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="pl-10 rounded-full bg-muted/30 border-0 focus-visible:ring-1"
                />
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>{onlineCount} online</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span>
                        {(conversations || []).reduce(
                            (sum, c) => sum + (c.unread || 0),
                            0
                        )}{" "}
                        unread
                    </span>
                </div>
            </div>

            {/* Conversations List */}
            <div className="space-y-2">
                {sortedConversations.length === 0 ? (
                    searchQuery ? (
                        <Card className="p-8 text-center">
                            <div className="text-muted-foreground mb-2">
                                No conversations found
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Try searching with different keywords
                            </div>
                        </Card>
                    ) : (
                        <Card className="p-8 text-center">
                            <MessageSquarePlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <div className="text-lg font-medium mb-2">No conversations yet</div>
                            <div className="text-sm text-muted-foreground mb-4">
                                Start a conversation with someone to begin chatting
                            </div>
                            <Button
                                onClick={() => navigate("/chats/new")}
                                className="rounded-full"
                            >
                                <MessageSquarePlus className="mr-2 h-4 w-4" />
                                Start a chat
                            </Button>
                        </Card>
                    )
                ) : (
                    sortedConversations.map((conversation) => {
                        const others =
                            conversation.participants?.filter(
                                (p) => p.user && String(p.user._id) !== String(me?._id)
                            ) || [];

                        const isGroup = conversation.isGroup || others.length > 1;
                        const title = isGroup
                            ? conversation.title || `Group (${others.length + 1})`
                            : others[0]?.user?.name ||
                            others[0]?.user?.username ||
                            "Unknown";

                        const lastMessage = conversation.lastMessage;
                        const isLastMessageMine =
                            lastMessage?.sender?._id === me?._id ||
                            String(lastMessage?.sender) === String(me?._id);

                        const anyOnline = others.some((p) => isUserOnline(p?.user?._id));
                        const unreadCount = conversation.unread || 0;

                        const avatarUrl = isGroup ? null : others[0]?.user?.avatarUrl;
                        const avatarFallback = isGroup ? (
                            <Users className="h-4 w-4" />
                        ) : (
                            others[0]?.user?.name?.[0]?.toUpperCase() ||
                            others[0]?.user?.username?.[0]?.toUpperCase() ||
                            "?"
                        );

                        return (
                            <Link key={conversation._id} to={`/chats/${conversation._id}`}>
                                <Card
                                    className={cn(
                                        "p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01] cursor-pointer group",
                                        "border-l-4",
                                        unreadCount > 0
                                            ? "border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20"
                                            : "border-l-transparent",
                                        conversation.isPinned &&
                                        "bg-yellow-50/30 dark:bg-yellow-950/20"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            <Avatar className="h-12 w-12">
                                                <AvatarImage src={avatarUrl} />
                                                <AvatarFallback className="text-sm">
                                                    {avatarFallback}
                                                </AvatarFallback>
                                            </Avatar>
                                            {!isGroup && (
                                                <div
                                                    className={cn(
                                                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                                                        anyOnline ? "bg-green-500" : "bg-gray-400"
                                                    )}
                                                />
                                            )}
                                            {conversation.isPinned && (
                                                <div className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-yellow-500 flex items-center justify-center">
                                                    <Pin className="h-2.5 w-2.5 text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Header */}
                                            <div className="flex items-center justify-between mb-1">
                                                <h3
                                                    className={cn(
                                                        "font-medium truncate",
                                                        unreadCount > 0 && "font-semibold"
                                                    )}
                                                >
                                                    {title}
                                                </h3>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {lastMessage && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatLastSeen(lastMessage.createdAt)}
                                                        </span>
                                                    )}
                                                    {unreadCount > 0 && (
                                                        <Badge
                                                            variant="default"
                                                            className="rounded-full h-5 min-w-[20px] text-xs px-1.5"
                                                        >
                                                            {unreadCount > 99 ? "99+" : unreadCount}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Last message */}
                                            <div className="flex items-center gap-2">
                                                {isLastMessageMine && lastMessage && (
                                                    <div className="shrink-0">
                                                        {lastMessage.read ? (
                                                            <CheckCheck className="h-3 w-3 text-blue-500" />
                                                        ) : (
                                                            <Check className="h-3 w-3 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                )}
                                                <p
                                                    className={cn(
                                                        "text-sm text-muted-foreground truncate",
                                                        unreadCount > 0 && "text-foreground font-medium"
                                                    )}
                                                >
                                                    {lastMessage?.text ? (
                                                        <>
                                                            {!isLastMessageMine &&
                                                                isGroup &&
                                                                `${lastMessage.sender?.name ||
                                                                lastMessage.sender?.username ||
                                                                "Someone"
                                                                }: `}
                                                            {truncateMessage(lastMessage.text)}
                                                        </>
                                                    ) : unreadCount > 0 ? (
                                                        "New message"
                                                    ) : (
                                                        "No messages yet"
                                                    )}
                                                </p>
                                            </div>

                                            {/* Status indicators */}
                                            <div className="flex items-center gap-3 mt-1">
                                                {!isGroup && (
                                                    <span
                                                        className={cn(
                                                            "text-xs",
                                                            anyOnline ? "text-green-600" : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {anyOnline ? "online" : "offline"}
                                                    </span>
                                                )}
                                                {isGroup && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {others.length + 1} members
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* More options */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                // Handle more options
                                            }}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            </Link>
                        );
                    })
                )}
            </div>

            {/* Quick actions for empty state */}
            {(conversations || []).length === 0 && (
                <div className="grid grid-cols-2 gap-3 mt-6">
                    <Card className="p-4 text-center cursor-pointer hover:bg-accent/50 transition-colors">
                        <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <div className="text-sm font-medium">Find Friends</div>
                        <div className="text-xs text-muted-foreground">
                            Discover people to chat with
                        </div>
                    </Card>
                    <Card className="p-4 text-center cursor-pointer hover:bg-accent/50 transition-colors">
                        <MessageSquarePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <div className="text-sm font-medium">New Group</div>
                        <div className="text-xs text-muted-foreground">
                            Create a group chat
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
