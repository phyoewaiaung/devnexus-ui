import React from "react";


export default function PresenceDot({ online }) {
    return (
        <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
        />
    );
}