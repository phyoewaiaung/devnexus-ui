// src/components/RichPostBody.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // not used here directly but handy for future reuse
import { Highlight, themes } from 'prism-react-renderer';
import {
    Code2, ClipboardCopy, CheckCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import copy from 'copy-to-clipboard';
import { toast } from 'sonner';

/* ---------------------- Code block (highlight + copy + collapse) ---------------------- */
export function CodeBlock({ code, lang = 'text', maxCollapsedLines = 18 }) {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const id = setTimeout(() => setCopied(false), 1400);
        return () => clearTimeout(id);
    }, [copied]);

    const lineCount = useMemo(() => (code || '').split('\n').length, [code]);
    const clamp = !expanded && lineCount > maxCollapsedLines;

    // Prism language aliases
    const normalizedLang = useMemo(() => {
        const map = { js: 'javascript', ts: 'typescript', shell: 'bash', sh: 'bash', cplusplus: 'cpp' };
        const l = (lang || 'text').toLowerCase();
        return map[l] || l;
    }, [lang]);

    return (
        <div className="group relative rounded-xl border border-border bg-muted/60">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b border-border">
                <div className="flex items-center gap-2">
                    <Code2 className="h-3.5 w-3.5" />
                    {normalizedLang}
                </div>
                <div className="flex items-center gap-1">
                    {lineCount > maxCollapsedLines && (
                        <Button variant="ghost" size="xs" className="h-7 px-2 text-xs" onClick={() => setExpanded(v => !v)}>
                            {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                            {expanded ? 'Collapse' : 'Expand'}
                        </Button>
                    )}
                    <Button
                        onClick={() => { copy(code || ''); setCopied(true); toast.success('Code copied'); }}
                        variant="ghost"
                        size="xs"
                        className="h-7 px-2 text-xs"
                        aria-label="Copy code"
                    >
                        {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                    </Button>
                </div>
            </div>

            <div className={clsx('overflow-auto', clamp && 'max-h-[360px]')}>
                <Highlight theme={themes.nightOwl} code={code || ''} language={normalizedLang}>
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre className={clsx(className, 'm-0 p-3 text-sm leading-[1.45]')} style={style}>
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })} className="table w-full">
                                    <span className="table-cell select-none pr-4 text-muted-foreground/70 text-right w-8">{i + 1}</span>
                                    <span className="table-cell">{line.map((token, key) => (<span key={key} {...getTokenProps({ token })} />))}</span>
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
            </div>
        </div>
    );
}

/* ---------------------- Inline linkification + inline code ---------------------- */
export function linkifyAndInlineCode(text) {
    const inlineCodeRe = /`([^`]+)`/g;
    const urlRe = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)/gi;
    const mentionRe = /(^|\s)@([a-zA-Z0-9_]{2,})/g;
    const tagRe = /(^|\s)#([\p{L}0-9_]{2,})/gu;

    const nodes = []; let idx = 0; let last = 0, m;
    while ((m = inlineCodeRe.exec(text))) {
        const [full, code] = m;
        if (m.index > last) nodes.push(text.slice(last, m.index));
        nodes.push(<code key={`ic-${idx++}`} className="rounded bg-muted px-1 py-0.5 text-[0.9em] font-mono">{code}</code>);
        last = m.index + full.length;
    }
    if (last < text.length) nodes.push(text.slice(last));

    const linkified = nodes.flatMap(n => {
        if (typeof n !== 'string') return [n];
        const s = n; const out = []; let i = 0;
        const re = new RegExp(`${urlRe.source}|${mentionRe.source}|${tagRe.source}`, 'giu'); let r;
        while ((r = re.exec(s))) {
            if (r.index > i) out.push(s.slice(i, r.index));
            const match = r[0];
            if (r[1] || r[2]) {
                const url = match.startsWith('http') ? match : `https://${match}`;
                out.push(<a key={`u-${idx++}`} href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-words">{match}</a>);
            } else if (r[3] || r[4]) {
                const handle = r[4];
                out.push(<Link key={`m-${idx++}`} to={`/u/${handle}`} className="text-primary hover:underline">@{handle}</Link>);
            } else if (r[5] || r[6]) {
                const tag = r[6];
                out.push(<Link key={`t-${idx++}`} to={`/?tag=${encodeURIComponent(tag)}`} className="text-primary hover:underline">#{tag}</Link>);
            }
            i = re.lastIndex;
        }
        if (i < s.length) out.push(s.slice(i));
        return out;
    });

    return <p className="leading-relaxed text-foreground/90">{linkified}</p>;
}

/* ---------------------- Rich fenced-markdown body (CRLF safe) ---------------------- */
export default function RichPostBody({ raw }) {
    if (!raw) return null;
    raw = raw.replace(/\r\n/g, '\n'); // normalize CRLF
    const fenceRe = /```([a-zA-Z0-9_+-]+)?\r?\n([\s\S]*?)```/g;

    const parts = []; let last = 0, m;
    while ((m = fenceRe.exec(raw))) {
        const [full, lang, code] = m;
        if (m.index > last) parts.push({ type: 'text', value: raw.slice(last, m.index) });
        parts.push({ type: 'code', value: code, lang: (lang || 'text').toLowerCase() });
        last = m.index + full.length;
    }
    if (last < raw.length) parts.push({ type: 'text', value: raw.slice(last) });

    return (
        <div className="space-y-3">
            {parts.map((p, i) =>
                p.type === 'code'
                    ? (<CodeBlock key={i} code={p.value} lang={p.lang} />)
                    : (<div key={i} className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">{linkifyAndInlineCode(p.value)}</div>)
            )}
        </div>
    );
}
