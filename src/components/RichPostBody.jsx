import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Highlight, themes } from 'prism-react-renderer';
import {
    Code2, ClipboardCopy, CheckCheck, ChevronDown, ChevronUp,
} from 'lucide-react';

// Toast implementation (you can replace with your actual toast)
const toast = {
    success: (msg) => console.log('Success:', msg),
    error: (msg) => console.error('Error:', msg)
};

/* ---------------------- Unified Code Block Component ---------------------- */
export function CodeBlock({ code, lang = 'text', maxCollapsedLines = 18, isPreview = false }) {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const id = setTimeout(() => setCopied(false), 1400);
        return () => clearTimeout(id);
    }, [copied]);

    const lineCount = useMemo(() => (code || '').split('\n').length, [code]);
    const clamp = !expanded && lineCount > maxCollapsedLines;

    // Normalize language aliases
    const normalizedLang = useMemo(() => {
        const map = {
            js: 'javascript',
            ts: 'typescript',
            shell: 'bash',
            sh: 'bash',
            cplusplus: 'cpp',
            py: 'python'
        };
        const l = (lang || 'text').toLowerCase();
        return map[l] || l;
    }, [lang]);

    const copyCode = () => {
        navigator.clipboard?.writeText(code || '').then(() => {
            setCopied(true);
            toast.success('Code copied to clipboard');
        }).catch(() => {
            toast.error('Failed to copy code');
        });
    };

    return (
        <div className="group relative rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                <div className="flex items-center gap-2">
                    <Code2 className="h-3.5 w-3.5" />
                    <span className="font-medium">{normalizedLang}</span>
                </div>
                {!isPreview && (
                    <div className="flex items-center gap-1">
                        {lineCount > maxCollapsedLines && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setExpanded(v => !v)}
                            >
                                {expanded ? (
                                    <ChevronUp className="h-3 w-3 mr-1" />
                                ) : (
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                )}
                                {expanded ? 'Collapse' : 'Expand'}
                            </Button>
                        )}
                        <Button
                            onClick={copyCode}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            aria-label="Copy code"
                        >
                            {copied ? (
                                <CheckCheck className="h-3 w-3" />
                            ) : (
                                <ClipboardCopy className="h-3 w-3" />
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {/* Code Content */}
            <div className={`overflow-x-auto ${clamp ? 'max-h-[360px] overflow-hidden' : ''}`}>
                <Highlight theme={themes.nightOwl} code={code || ''} language={normalizedLang}>
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                            className={`${className} m-0 p-3 text-sm leading-[1.45] bg-transparent`}
                            style={{ ...style, background: 'transparent' }}
                        >
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })} className="table-row">
                                    <span className="table-cell select-none pr-4 text-gray-500 dark:text-gray-400 text-right w-8 font-mono text-xs">
                                        {i + 1}
                                    </span>
                                    <span className="table-cell">
                                        {line.map((token, key) => (
                                            <span key={key} {...getTokenProps({ token })} />
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
            </div>

            {/* Gradient overlay for collapsed code */}
            {clamp && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent pointer-events-none" />
            )}
        </div>
    );
}

/* ---------------------- Enhanced Link and Inline Code Processing ---------------------- */
function processInlineFormatting(text) {
    if (!text) return null;

    const parts = [];
    let currentIndex = 0;

    // Combined regex for inline code, URLs, mentions, and hashtags
    const combinedRegex = /(`[^`]+`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[(.*?)\]\((.*?)\))|(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)|(^|\s)(@[a-zA-Z0-9_]{2,})|(\s|^)(#[\p{L}0-9_]{2,})/gu;

    let match;
    let keyIndex = 0;

    while ((match = combinedRegex.exec(text)) !== null) {
        // Add text before match
        if (match.index > currentIndex) {
            parts.push(text.slice(currentIndex, match.index));
        }

        const [fullMatch, inlineCode, boldFull, boldContent, italicFull, italicContent, linkFull, linkText, linkUrl, httpUrl, wwwUrl, mentionSpace, mention, hashSpace, hashtag] = match;

        if (inlineCode) {
            // Inline code
            parts.push(
                <code
                    key={`code-${keyIndex++}`}
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono text-gray-800 dark:text-gray-200 border"
                >
                    {inlineCode.slice(1, -1)}
                </code>
            );
        } else if (boldFull && boldContent) {
            // Bold text
            parts.push(
                <strong key={`bold-${keyIndex++}`} className="font-semibold">
                    {boldContent}
                </strong>
            );
        } else if (italicFull && italicContent) {
            // Italic text
            parts.push(
                <em key={`italic-${keyIndex++}`} className="italic">
                    {italicContent}
                </em>
            );
        } else if (linkFull && linkText && linkUrl) {
            // Markdown links
            parts.push(
                <a
                    key={`link-${keyIndex++}`}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                    {linkText}
                </a>
            );
        } else if (httpUrl) {
            // HTTP/HTTPS URLs
            parts.push(
                <a
                    key={`url-${keyIndex++}`}
                    href={httpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                    {httpUrl}
                </a>
            );
        } else if (wwwUrl) {
            // www URLs
            parts.push(
                <a
                    key={`www-${keyIndex++}`}
                    href={`https://${wwwUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                    {wwwUrl}
                </a>
            );
        } else if (mention) {
            // User mentions
            const username = mention.slice(1); // Remove @
            parts.push(
                mentionSpace || '',
                <Link
                    key={`mention-${keyIndex++}`}
                    to={`/u/${username}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    @{username}
                </Link>
            );
        } else if (hashtag) {
            // Hashtags
            const tag = hashtag.slice(1); // Remove #
            parts.push(
                hashSpace || '',
                <Link
                    key={`tag-${keyIndex++}`}
                    to={`/?tag=${encodeURIComponent(tag)}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    #{tag}
                </Link>
            );
        }

        currentIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
        parts.push(text.slice(currentIndex));
    }

    return parts.length > 0 ? parts : [text];
}

/* ---------------------- Block-level Markdown Processing ---------------------- */
function processBlockFormatting(text) {
    if (!text) return null;

    const lines = text.split('\n');
    const processedLines = [];
    let keyIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Headers
        if (trimmedLine.startsWith('### ')) {
            processedLines.push(
                <h3 key={`h3-${keyIndex++}`} className="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">
                    {processInlineFormatting(trimmedLine.slice(4))}
                </h3>
            );
        } else if (trimmedLine.startsWith('## ')) {
            processedLines.push(
                <h2 key={`h2-${keyIndex++}`} className="text-xl font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">
                    {processInlineFormatting(trimmedLine.slice(3))}
                </h2>
            );
        } else if (trimmedLine.startsWith('# ')) {
            processedLines.push(
                <h1 key={`h1-${keyIndex++}`} className="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">
                    {processInlineFormatting(trimmedLine.slice(2))}
                </h1>
            );
        }
        // Blockquotes
        else if (trimmedLine.startsWith('> ')) {
            processedLines.push(
                <blockquote key={`quote-${keyIndex++}`} className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-2">
                    {processInlineFormatting(trimmedLine.slice(2))}
                </blockquote>
            );
        }
        // Ordered lists
        else if (trimmedLine.match(/^\d+\.\s/)) {
            processedLines.push(
                <li key={`ol-${keyIndex++}`} className="ml-6 list-decimal list-outside">
                    {processInlineFormatting(trimmedLine.replace(/^\d+\.\s/, ''))}
                </li>
            );
        }
        // Unordered lists
        else if (trimmedLine.startsWith('- ')) {
            processedLines.push(
                <li key={`ul-${keyIndex++}`} className="ml-6 list-disc list-outside">
                    {processInlineFormatting(trimmedLine.slice(2))}
                </li>
            );
        }
        // Regular paragraphs
        else if (trimmedLine) {
            processedLines.push(
                <p key={`p-${keyIndex++}`} className="leading-relaxed text-gray-800 dark:text-gray-200 mb-2">
                    {processInlineFormatting(line)}
                </p>
            );
        }
        // Empty lines
        else {
            processedLines.push(<br key={`br-${keyIndex++}`} />);
        }
    }

    return processedLines;
}

/* ---------------------- Main Rich Post Body Component ---------------------- */
export default function RichPostBody({ raw }) {
    if (!raw) return null;

    // Normalize line endings
    const normalizedContent = raw.replace(/\r\n/g, '\n');

    // Extract code blocks first
    const fenceRe = /```([a-zA-Z0-9_+-]+)?\r?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = fenceRe.exec(normalizedContent)) !== null) {
        const [fullMatch, lang, code] = match;

        // Add text before code block
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                value: normalizedContent.slice(lastIndex, match.index)
            });
        }

        // Add code block
        parts.push({
            type: 'code',
            value: code,
            lang: (lang || 'text').toLowerCase()
        });

        lastIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < normalizedContent.length) {
        parts.push({
            type: 'text',
            value: normalizedContent.slice(lastIndex)
        });
    }

    return (
        <div className="space-y-3">
            {parts.map((part, index) => {
                if (part.type === 'code') {
                    return (
                        <CodeBlock
                            key={index}
                            code={part.value}
                            lang={part.lang}
                            maxCollapsedLines={18}
                        />
                    );
                } else {
                    return (
                        <div key={index} className="space-y-2">
                            {processBlockFormatting(part.value)}
                        </div>
                    );
                }
            })}
        </div>
    );
}