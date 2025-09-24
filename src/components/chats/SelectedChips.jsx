import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { nameOf, initials } from "@/utils/chat";


export function SelectedChipsInline({ selected, onRemove }) {
    if (!selected?.length) return null;
    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {selected.map((u) => (
                <span key={u._id} className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm">
                    {nameOf(u)}
                    <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => onRemove(u._id)}
                        aria-label={`Remove ${nameOf(u)}`}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </span>
            ))}
        </div>
    );
}


export function SelectedPanel({ selected, onRemove }) {
    return (
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
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRemove(u._id)}
                            className="text-destructive"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}