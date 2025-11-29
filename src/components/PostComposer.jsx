import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Image as ImageIcon,
  Loader2,
  SmilePlus,
  X,
  Code2,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Hash,
  Type,
  Eye,
  Edit3,
  Search as SearchIcon,
} from 'lucide-react';
import RichPostBody from './RichPostBody';
import { createPost } from '@/api/posts';
import { useAuth } from '@/context/AuthContext';

const toast = {
  success: (msg) => console.log('Success:', msg),
  error: (msg) => console.error('Error:', msg),
};

// ===== Config =====
const MAX_LEN = 5000;
const RECENT_KEY = 'dn_recent_emojis';
const RECENT_MAX = 18;

// A compact emoji dataset (curated for general-purpose posting).
const EMOJI_SETS = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '😘', '😗', '😙', '😚', '😋', '😜', '🤪', '😝', '🫠', '🤗', '🤭', '🫢', '🤫', '🤔', '🫡', '🤤', '🤯', '😴', '🥱', '😪', '😵', '🤐', '🥳', '😎', '🤓', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '😌', '😔', '😕', '🫤', '🙃'
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤟', '🤘', '🤙', '👋', '🤝', '👏', '🙌', '🫶', '🙏', '💪', '☝️', '👆', '👇', '👉', '👈', '🖐️', '✋', '🖖', '🤲'
    ],
  },
  {
    name: 'Hearts & Reactions',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💖', '💘', '💝', '💗', '💓', '💞', '💕', '💔', '💯', '🔥', '✨', '⚡', '🌟', '💥', '💫', '🫧', '🎉', '🎊'
    ],
  },
  {
    name: 'Animals & Food',
    emojis: [
      '🐶', '🐱', '🐻', '🐼', '🦊', '🦁', '🐯', '🦄', '🐸', '🐵', '🐧', '🐤', '🐣', '🐥', '🍏', '🍎', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥑', '🍕', '🍔', '🍟', '🌮', '🍣', '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '🍺', '🍻', '☕', '🧋'
    ],
  },
  {
    name: 'Objects & Symbols',
    emojis: [
      '🧠', '🖥️', '💻', '⌨️', '🖱️', '🛠️', '🧰', '🧪', '🚀', '📌', '📎', '📚', '📦', '🗂️', '📝', '✏️', '🖊️', '📈', '📉', '📊', '⏱️', '⏰', '🗓️', '📅', '🔒', '🔑', '🔔', '🔕', '♻️', '✅', '☑️', '❌', '⚠️', '❗', '❓'
    ],
  },
];

// ===== Helpers for Recent Emojis =====
function loadRecentEmojis() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentEmojis(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // ignore
  }
}

// ===== Component =====
export default function PostComposer({ onCreated }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeLang, setCodeLang] = useState('javascript');
  const [codeText, setCodeText] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);

  // NEW: visibility state — 'public' | 'followers'
  const [visibility, setVisibility] = useState('public');

  // Emoji picker state
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState([]);

  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const { user } = useAuth();

  const remaining = MAX_LEN - text.length;
  const progress = Math.min(100, Math.round((text.length / MAX_LEN) * 100));
  const avatarSrc = user?.avatarUrl || user?.avatar || '';
  const avatarFallback = user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '👤';

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    setRecentEmojis(loadRecentEmojis());
  }, []);

  const pick = () => fileRef.current?.click();

  const acceptFile = useCallback((f) => {
    if (!f) return;
    if (!f.type?.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB.');
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const onFileChange = (e) => acceptFile(e.target.files?.[0] || null);
  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find(
      (it) => it.kind === 'file' && it.type.startsWith('image/')
    );
    if (item) acceptFile(item.getAsFile());
  };
  const onDrop = (e) => {
    e.preventDefault();
    acceptFile(e.dataTransfer?.files?.[0] || null);
  };

  const insertAtCursor = (before, after = '', placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    const replacement = selectedText || placeholder;
    const newText =
      text.substring(0, start) + before + replacement + after + text.substring(end);
    setText(newText.slice(0, MAX_LEN));
    requestAnimationFrame(() => {
      const newCursorPos = start + before.length + replacement.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    });
  };

  const formatBold = () => insertAtCursor('**', '**', 'bold text');
  const formatItalic = () => insertAtCursor('*', '*', 'italic text');
  const formatCode = () => insertAtCursor('`', '`', 'inline code');
  const formatLink = () => insertAtCursor('[', '](url)', 'link text');
  const formatQuote = () => insertAtCursor('\n> ', '', 'quote text');
  const formatList = () => insertAtCursor('\n- ', '', 'list item');
  const formatOrderedList = () => insertAtCursor('\n1. ', '', 'list item');
  const formatHeading = () => insertAtCursor('\n## ', '', 'heading');

  const insertCode = () => {
    if (!codeText.trim()) return;
    const block = `\n\n\`\`\`${codeLang}\n${codeText.replace(/\n$/, '')}\n\`\`\`\n`;
    setText((t) => (t || '').concat(block).slice(0, MAX_LEN));
    setCodeText('');
    setCodeOpen(false);
    setShowCodePreview(false);
  };

  // ===== Emoji insertion =====
  const insertEmoji = (emoji) => {
    if (isPreviewMode) setIsPreviewMode(false);

    const textarea = textareaRef.current;
    if (!textarea) {
      setText((t) => (t + emoji).slice(0, MAX_LEN));
    } else {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setText(newText.slice(0, MAX_LEN));
      requestAnimationFrame(() => {
        const caret = start + emoji.length;
        textarea.setSelectionRange(caret, caret);
        textarea.focus();
      });
    }

    // Update recents
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, RECENT_MAX);
      saveRecentEmojis(next);
      return next;
    });
  };

  const filteredEmojiSets = EMOJI_SETS.map((set) => {
    if (!emojiQuery.trim()) return set;
    const q = emojiQuery.trim().toLowerCase();
    const TAGS = {
      Smileys: ['smile', 'happy', 'lol', 'joy', 'grin', 'wink', 'kiss', 'heart', 'sweat', 'sleep', 'cool', 'party', 'thinking'],
      Gestures: ['thumb', 'ok', 'v', 'hand', 'clap', 'pray', 'muscle', 'point', 'wave'],
      'Hearts & Reactions': ['heart', 'love', 'spark', 'fire', 'party', 'star', '100', 'boom', 'bang'],
      'Animals & Food': ['dog', 'cat', 'bear', 'panda', 'fox', 'lion', 'unicorn', 'bird', 'chick', 'fruit', 'pizza', 'burger', 'fries', 'taco', 'sushi', 'cake', 'cookie', 'coffee'],
      'Objects & Symbols': ['computer', 'laptop', 'keyboard', 'mouse', 'tool', 'rocket', 'pin', 'paper', 'book', 'note', 'chart', 'clock', 'calendar', 'lock', 'bell', 'recycle', 'check', 'cross', 'warning', 'question', 'exclamation'],
    };
    const hitsTags = (TAGS[set.name] || []).some((t) => t.includes(q));
    if (hitsTags) return set;
    return { ...set, emojis: set.emojis.filter(() => true) };
  });

  async function submit(e) {
    if (e) e.preventDefault();
    if (!text.trim() && !file) return;
    if (busy) return;
    setBusy(true);

    try {
      const { post } = await createPost({
        text: text.trim(),
        image: file || undefined,
        visibility, // NEW
      });
      toast.success('Post created successfully');

      setText('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setPreview('');

      onCreated?.(post);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Failed to post');
    } finally {
      setBusy(false);
    }
  }

  const isFollowersOnly = visibility === 'followers';

  return (
    <Card className="w-full max-w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
      <form
        className="p-3 sm:p-4 space-y-3"
        onSubmit={submit}
        onPaste={onPaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 ring-1 ring-neutral-200 dark:ring-neutral-800 flex-shrink-0">
            <AvatarImage src={avatarSrc} alt={user?.name || user?.username || 'Profile avatar'} />
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={formatBold} className="h-8 w-8 p-0" title="Bold"><Bold className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={formatItalic} className="h-8 w-8 p-0" title="Italic"><Italic className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={formatCode} className="h-8 w-8 p-0" title="Inline Code"><Type className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={formatHeading} className="h-8 w-8 p-0" title="Heading"><Hash className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={formatQuote} className="h-8 w-8 p-0" title="Quote"><Quote className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={formatList} className="h-8 w-8 p-0" title="Bullet List"><List className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={formatOrderedList} className="h-8 w-8 p-0" title="Numbered List"><ListOrdered className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={formatLink} className="h-8 w-8 p-0" title="Link"><LinkIcon className="h-4 w-4" /></Button>
              </div>

              <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-700 mx-1" />

              <Button
                type="button"
                variant={isPreviewMode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="gap-1 h-8 px-3 text-sm"
                aria-pressed={isPreviewMode}
              >
                {isPreviewMode ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>{isPreviewMode ? 'Edit' : 'Preview'}</span>
              </Button>

              {/* Visibility Toggle */}
              <div className="ml-auto flex items-center gap-2 pl-2">
                <Switch
                  id="vis-switch"
                  checked={isFollowersOnly}
                  onCheckedChange={(v) => setVisibility(v ? 'followers' : 'public')}
                  aria-label="Toggle followers-only visibility"
                />
                <Label htmlFor="vis-switch" className="text-xs sm:text-sm">
                  {isFollowersOnly ? 'Followers only' : 'Public'}
                </Label>
              </div>
            </div>

            {/* Editor / Preview */}
            {isPreviewMode ? (
              <div className="whitespace-pre-wrap"><RichPostBody raw={text} /></div>
            ) : (
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
                placeholder="Share something with DevNexus… Use markdown for rich formatting!"
                className="min-h-[80px] resize-y border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
                aria-label="Post text"
                wrap="soft"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e);
                }}
              />
            )}

            {/* Image preview */}
            {preview && (
              <div className="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800">
                <img src={preview} alt="Selected image preview" className="w-full h-auto object-cover max-h-96" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg"
                  onClick={() => {
                    setPreview((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return '';
                    });
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Separator className="my-3 bg-neutral-200 dark:bg-neutral-800" />

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                  aria-label="Upload image"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={pick}
                  className="gap-1.5 text-xs sm:text-sm"
                >
                  <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Photo</span>
                </Button>

                <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm">
                      <Code2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Code</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[800px] w-[95vw] h-[77vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0 flex items-center justify-between">
                      <DialogTitle>Insert Code Block</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 px-1">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Language</label>
                        <select
                          value={codeLang}
                          onChange={(e) => setCodeLang(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                        >
                          {[
                            'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'go', 'rust', 'cpp', 'c', 'csharp', 'php', 'ruby', 'dart', 'scala',
                            'clojure', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'sql', 'bash', 'powershell', 'dockerfile', 'markdown', 'latex', 'r', 'matlab', 'haskell', 'elixir',
                          ].map((lang) => (
                            <option key={lang} value={lang}>
                              {lang.charAt(0).toUpperCase() + lang.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1">
                        <div className='flex items-center justify-between mb-2'>
                          <label className="text-sm font-medium mb-2 block">
                            Code
                          </label>
                          <div className="flex items-center gap-2">
                            <Switch id="preview-toggle" checked={showCodePreview} onCheckedChange={setShowCodePreview} />
                            <Label htmlFor="preview-toggle" className="text-sm">Preview</Label>
                          </div>
                        </div>

                        {showCodePreview ? (
                          <div className="h-[30vh] max-h-[30vh] overflow-y-auto bg-neutral-50 dark:bg-neutral-800/50 rounded-md p-3">
                            {codeText.trim() ? (
                              <RichPostBody raw={`\`\`\`${codeLang}\n${codeText}\n\`\`\``} />
                            ) : (
                              <p className="text-sm text-neutral-500">Nothing to preview yet.</p>
                            )}
                          </div>
                        ) : (
                          <Textarea
                            value={codeText}
                            onChange={(e) => setCodeText(e.target.value)}
                            placeholder="Paste or type your code…"
                            className="h-[30vh] max-h-[30vh] font-mono text-sm whitespace-pre resize-none overflow-y-auto"
                            wrap="off"
                          />
                        )}
                      </div>
                    </div>

                    <DialogFooter className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                      <Button type="button" variant="outline" onClick={() => setCodeOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={insertCode} disabled={!codeText.trim()}>
                        Insert Code Block
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Emoji Picker */}
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm">
                      <SmilePlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Emoji</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-2" align="start">
                    <div className="flex items-center gap-2 mb-2">
                      <SearchIcon className="h-4 w-4 text-neutral-500" />
                      <Input
                        value={emojiQuery}
                        onChange={(e) => setEmojiQuery(e.target.value)}
                        placeholder="Search emojis…"
                        className="h-8"
                        aria-label="Search emojis"
                      />
                    </div>

                    {/* Recent */}
                    {recentEmojis.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-neutral-500 px-1 mb-1">Recent</div>
                        <div className="grid grid-cols-8 gap-1.5">
                          {recentEmojis.map((e, idx) => (
                            <button
                              key={`recent-${idx}-${e}`}
                              className="h-9 w-9 text-xl rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={() => {
                                insertEmoji(e);
                                setEmojiOpen(false);
                              }}
                              aria-label={`Insert ${e}`}
                              type="button"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <ScrollArea className="h-[260px] pr-1">
                      <div className="space-y-3">
                        {EMOJI_SETS.map((set) => (
                          <div key={set.name}>
                            <div className="text-xs font-medium text-neutral-500 px-1 mb-1">{set.name}</div>
                            <div className="grid grid-cols-8 gap-1.5">
                              {set.emojis.map((e, idx) => (
                                <button
                                  key={`${set.name}-${idx}-${e}`}
                                  className="h-9 w-9 text-xl rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  onClick={() => {
                                    insertEmoji(e);
                                    setEmojiOpen(false);
                                  }}
                                  aria-label={`Insert ${e}`}
                                  type="button"
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <div className="flex items-center gap-2 ml-auto">
                  <Badge
                    variant={remaining < 100 ? 'destructive' : 'secondary'}
                    className="tabular-nums text-xs"
                    aria-live="polite"
                  >
                    {remaining.toLocaleString()}
                  </Badge>
                  <div className="h-1.5 w-16 sm:w-24 rounded-full bg-neutral-200 dark:bg-neutral-800 hidden sm:block" aria-hidden>
                    <div
                      className={
                        'h-1.5 rounded-full transition-all duration-300 ' +
                        (progress > 95
                          ? 'bg-red-500'
                          : progress > 80
                            ? 'bg-yellow-500'
                            : 'bg-blue-500')
                      }
                      style={{ width: Math.min(100, progress) + '%' }}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy || (!text.trim() && !file)}
                    className="min-w-[70px] sm:min-w-[80px] bg-blue-600 dark:text-white hover:bg-blue-700 text-xs sm:text-sm"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5" /> : null}
                    {busy ? 'Publishing…' : 'Post'}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Use markdown for rich formatting. Paste or drag images. Press ⌘/Ctrl + Enter to post.
            </p>
          </div>
        </div>
      </form>
    </Card>
  );
}
