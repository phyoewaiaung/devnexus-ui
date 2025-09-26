// src/pages/ProfilePage.jsx — Polished shadcn UI/UX with cover upload + DM jump + realtime presence
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getPublicProfile,
  followUser,
  unfollowUser,
  uploadCover,
  clearCover,
} from '../api/users';
import { getPostsByUser } from '../api/posts';
import PostCard from '../components/PostCard';

// shadcn/ui
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

// icons
import {
  Globe,
  Github,
  Twitter,
  Linkedin,
  PencilLine,
  ImagePlus,
  Trash2,
  MessageSquare,
} from 'lucide-react';

// toast
import { toast } from 'sonner';

// presence
import { useNotifications } from '@/providers/NotificationsProvider';

// ✅ align with ChatsPage: use the same API wrapper
import { ChatsAPI } from '@/api/chat';

export default function ProfilePage() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const { isOnline } = useNotifications();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState('');

  const isMe = useMemo(() => !!me && me.username === username, [me, username]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError('');
      setLoadingProfile(true);
      setLoadingPosts(true);
      try {
        const [{ user }, postsResp] = await Promise.all([
          getPublicProfile(username),
          getPostsByUser(username),
        ]);
        if (!alive) return;

        const normalized = user
          ? {
            ...user,
            isFollowing:
              typeof user.isFollowing === 'boolean'
                ? user.isFollowing
                : Array.isArray(user.followers) && me?._id
                  ? user.followers.includes(me._id)
                  : false,
          }
          : null;

        setProfile(normalized);

        const mapped = (postsResp.posts || []).map((p) => ({
          ...p,
          canDelete: me && p.author?._id === me._id,
        }));
        setPosts(mapped);
      } catch (e) {
        if (!alive) return;
        setError(e.message || 'Failed to load profile.');
      } finally {
        if (!alive) return;
        setLoadingProfile(false);
        setLoadingPosts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [username, me]);

  const onFollow = async () => {
    await followUser(username);
    setProfile((prev) =>
      prev
        ? {
          ...prev,
          followersCount: (prev.followersCount || 0) + 1,
          isFollowing: true,
          followers:
            Array.isArray(prev.followers) && me?._id
              ? Array.from(new Set([...prev.followers, me._id]))
              : prev.followers,
        }
        : prev
    );
  };

  const onUnfollow = async () => {
    await unfollowUser(username);
    setProfile((prev) =>
      prev
        ? {
          ...prev,
          followersCount: Math.max((prev.followersCount || 1) - 1, 0),
          isFollowing: false,
          followers:
            Array.isArray(prev.followers) && me?._id
              ? prev.followers.filter((id) => id !== me._id)
              : prev.followers,
        }
        : prev
    );
  };

  // 🟢 Quick DM: uses ChatsAPI.startDM to match ChatsPage
  const [startingChat, setStartingChat] = useState(false);
  const startChat = async () => {
    try {
      if (!profile?._id || isMe || startingChat) return;
      setStartingChat(true);

      // If a DM already exists, most backends return that; otherwise a new one is created.
      const convo = await ChatsAPI.startDM(profile._id, { initialMessage: '' });
      const convoId = convo?._id || convo?.id || convo?.conversationId;
      if (!convoId) throw new Error('Conversation not found');

      navigate(`/chats/${convoId}`);
    } catch (e) {
      toast.error(e.message || 'Failed to start chat');
    } finally {
      setStartingChat(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (loadingProfile) return <HeaderSkeleton />;

  if (!profile) {
    return (
      <Card className="p-6 text-center">
        <div className="text-sm text-muted-foreground">Profile not found.</div>
      </Card>
    );
  }

  const online = profile?._id ? isOnline(profile._id) : false;

  return (
    <div className="space-y-4">
      <ProfileHeader
        profile={profile}
        isMe={isMe}
        onFollow={onFollow}
        onUnfollow={onUnfollow}
        onCoverChange={(urlOrNull) =>
          setProfile((p) => (p ? { ...p, coverUrl: urlOrNull } : p))
        }
        onStartChat={startChat}
        isOnline={online}
        startingChat={startingChat}
      />

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-3 mt-4">
          {loadingPosts ? (
            <PostsSkeleton />
          ) : posts.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-sm text-muted-foreground">No posts yet.</div>
            </Card>
          ) : (
            posts.map((p) => (
              <PostCard
                key={p._id}
                post={p}
                onDeleted={(id) =>
                  setPosts((prev) => prev.filter((x) => x._id !== id))
                }
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="about" className="mt-4">
          <AboutCard profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileHeader({
  profile,
  isMe,
  onFollow,
  onUnfollow,
  onCoverChange,
  onStartChat,
  isOnline,
  startingChat = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [following, setFollowing] = useState(!!profile.isFollowing);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setFollowing(!!profile.isFollowing);
  }, [profile.isFollowing]);

  const pickFile = () => fileInputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Cover must be ≤ 5 MB');

    setUploading(true);
    try {
      const { coverUrl } = await uploadCover(file);
      onCoverChange?.(coverUrl);
      toast.success('Cover updated');
    } catch (err) {
      toast.error(err.message || 'Failed to upload cover');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeCover = async () => {
    setUploading(true);
    try {
      await clearCover();
      onCoverChange?.(null);
      toast.success('Cover removed');
    } catch (err) {
      toast.error(err.message || 'Failed to remove cover');
    } finally {
      setUploading(false);
    }
  };

  const toggleFollow = async () => {
    if (pending) return;
    const next = !following;
    setFollowing(next);
    setPending(true);
    try {
      if (next) await onFollow?.();
      else await onUnfollow?.();
    } catch (e) {
      setFollowing(!next);
      toast.error(e.message || (next ? 'Failed to follow' : 'Failed to unfollow'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Cover */}
      <div className="relative h-32 w-full sm:h-40">
        {profile.coverUrl ? (
          <img
            src={profile.coverUrl}
            alt={`${profile.username} cover`}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-[#3C81D2] to-[#8B5CF6]" />
        )}

        {isMe && (
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" disabled={uploading} className="shadow">
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {uploading ? 'Updating…' : 'Change cover'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-white">
                <DropdownMenuItem onClick={pickFile}>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Upload…
                </DropdownMenuItem>
                {profile.coverUrl && (
                  <DropdownMenuItem className="text-destructive" onClick={removeCover}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Avatar + name + actions */}
      <div className="p-4 sm:p-6">
        <div className="-mt-12 flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20 ring-4 ring-background select-none">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={`${profile.username} avatar`} />
              ) : (
                <AvatarFallback className="text-lg">
                  {profile.name?.[0]?.toUpperCase() || profile.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              )}
            </Avatar>
            {!isMe && (
              <span
                className={`absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full border-2 border-background ${isOnline ? 'bg-emerald-500' : 'bg-muted'
                  }`}
                title={isOnline ? 'Online' : 'Offline'}
                aria-label={isOnline ? 'Online' : 'Offline'}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-end gap-2">
              <h2 className="text-xl font-semibold leading-tight truncate">
                {profile.name || profile.username}
              </h2>
              {profile.username && (
                <span className="text-sm text-muted-foreground truncate">@{profile.username}</span>
              )}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              {!isMe && (
                <span className="ml-2">
                  • {isOnline ? <span className="text-emerald-600">Online</span> : 'Offline'}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {isMe ? (
            <Button asChild size="sm">
              <Link to="/settings/profile">
                <PencilLine className="mr-2 h-4 w-4" /> Edit Profile
              </Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={following ? 'secondary' : 'default'}
                onClick={toggleFollow}
                disabled={pending}
                aria-pressed={following}
                aria-busy={pending}
                className="min-w-[96px]"
              >
                {following ? 'Following' : 'Follow'}
              </Button>

              {/* 💬 Start chat (DM) */}
              <Button
                size="sm"
                variant="outline"
                onClick={onStartChat}
                className="min-w-[120px]"
                disabled={startingChat}
                aria-busy={startingChat}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {startingChat ? 'Opening…' : 'Message'}
              </Button>
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap">{profile.bio}</p>
        )}

        {/* Skills */}
        {Array.isArray(profile.skills) && profile.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.skills.map((s, i) => (
              <Badge key={`${s}-${i}`} variant="secondary" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>
        )}

        {/* Social + Stats */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {profile.socialLinks?.website && (
              <Button asChild size="sm" variant="outline">
                <a href={profile.socialLinks.website} target="_blank" rel="noreferrer">
                  <Globe className="mr-2 h-4 w-4" /> Website
                </a>
              </Button>
            )}
            {profile.socialLinks?.github && (
              <Button asChild size="sm" variant="outline">
                <a href={profile.socialLinks.github} target="_blank" rel="noreferrer">
                  <Github className="mr-2 h-4 w-4" /> GitHub
                </a>
              </Button>
            )}
            {profile.socialLinks?.twitter && (
              <Button asChild size="sm" variant="outline">
                <a href={profile.socialLinks.twitter} target="_blank" rel="noreferrer">
                  <Twitter className="mr-2 h-4 w-4" /> Twitter
                </a>
              </Button>
            )}
            {profile.socialLinks?.linkedin && (
              <Button asChild size="sm" variant="outline">
                <a href={profile.socialLinks.linkedin} target="_blank" rel="noreferrer">
                  <Linkedin className="mr-2 h-4 w-4" /> LinkedIn
                </a>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Followers: {profile.followersCount || 0}</span>
            <span>Following: {profile.followingCount || 0}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// --- About & skeletons (unchanged) ---
function InfoField({ label, children }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium min-h-[1.25rem]">{children || '-'}</div>
    </div>
  );
}

function SocialLink({ href, children }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted transition-colors"
    >
      {children}
    </a>
  );
}

function AboutCard({ profile }) {
  const socials = profile.socialLinks || {};
  const roles =
    Array.isArray(profile.roles) && profile.roles.length > 0 ? profile.roles.join(', ') : 'user';

  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <InfoField label="Name">{profile.name || '-'}</InfoField>
          <InfoField label="Username">
            {profile.username ? <span className="text-foreground/90">@{profile.username}</span> : '-'}
          </InfoField>
          <InfoField label="Roles">{roles}</InfoField>
        </div>

        <div className="space-y-3">
          <InfoField label="Website">
            {socials.website ? (
              <a
                href={socials.website}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 break-all"
              >
                {socials.website}
              </a>
            ) : (
              '-'
            )}
          </InfoField>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Socials</div>
            {socials.github || socials.twitter || socials.linkedin ? (
              <div className="flex flex-wrap gap-2">
                <SocialLink href={socials.github}>
                  <Github className="h-4 w-4" /> GitHub
                </SocialLink>
                <SocialLink href={socials.twitter}>
                  <Twitter className="h-4 w-4" /> Twitter
                </SocialLink>
                <SocialLink href={socials.linkedin}>
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </SocialLink>
              </div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground">No social links</div>
            )}
          </div>
        </div>
      </div>

      {(profile.bio || (Array.isArray(profile.skills) && profile.skills.length > 0)) && (
        <>
          <Separator className="my-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {profile.bio && (
              <div className="lg:col-span-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Bio</div>
                <p className="text-sm whitespace-pre-wrap leading-6">{profile.bio}</p>
              </div>
            )}

            {Array.isArray(profile.skills) && profile.skills.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((s, i) => (
                    <Badge key={`${s}-${i}`} variant="secondary" className="font-normal">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function HeaderSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-24 w-full bg-muted" />
      <div className="p-4 sm:p-6">
        <div className="-mt-12 flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full ring-4 ring-background" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </Card>
  );
}

function PostsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/4 mb-2" />
              <Skeleton className="h-3 w-1/6" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-9/12" />
            <Skeleton className="h-4 w-8/12" />
          </div>
        </Card>
      ))}
    </div>
  );
}
