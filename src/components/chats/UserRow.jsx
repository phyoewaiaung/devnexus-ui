import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Check, MessageCircle } from "lucide-react";
import { nameOf, initials } from "@/utils/chat";


export default function UserRow({ user, selected, onToggle, onDM }) {
    return (
        <div
            className={`w-full px-3 py-2 rounded-lg hover:bg-accent flex items-center gap-3 ${selected ? "bg-accent/60" : ""}`}
        >
            <button onClick={() => onToggle(user)} className="flex-1 flex items-center gap-3 text-left">
                <Avatar className="h-8 w-8">
                    {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt={nameOf(user)} />
                    ) : (
                        <AvatarFallback>{initials(user)}</AvatarFallback>
                    )}
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