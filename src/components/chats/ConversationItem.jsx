import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";
import PresenceDot from "./PresenceDot";
import { nameOf, initials, lastMessagePreview } from "@/utils/chat";


export default function ConversationItem({ convo, meId, isOnline }) {
    const other = useMemo(() => {
        const others = (convo.participants || [])
            .map((p) => p.user)
            .filter((u) => String(u?._id || u) !== String(meId));
        return convo.isGroup ? null : others[0];
    }, [convo, meId]);


    const online = useMemo(() => {
        const otherId = other?._id || other;
        return typeof isOnline === "function" && otherId ? !!isOnline(String(otherId)) : false;
    }, [isOnline, other]);


    const title = convo.isGroup ? (convo.title || "Group") : nameOf(other);


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