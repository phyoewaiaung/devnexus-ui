import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getPostById } from "@/api/posts";
import PostCard from "@/components/PostCard";
import Meta from "@/components/Meta";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

/* ---------------- skeleton UI ---------------- */
function Line({ w = "100%" }) {
    return <div className="h-3 rounded bg-muted animate-pulse" style={{ width: w }} />;
}
function PostSkeleton() {
    return (
        <Card className="bg-card border-border">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                        <Line w="32%" />
                        <Line w="18%" />
                    </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-2">
                    <Line />
                    <Line w="92%" />
                    <Line w="88%" />
                    <Line w="42%" />
                </div>
                <div className="mt-4 h-56 w-full rounded-lg bg-muted animate-pulse" />
            </CardContent>
        </Card>
    );
}

/* ---------------- not found ---------------- */
function NotFoundBlock({ id }) {
    const navigate = useNavigate();
    return (
        <Card className="bg-card border-border">
            <CardContent className="p-6 text-center space-y-3">
                <h2 className="text-xl font-semibold">Post not found</h2>
                <p className="text-muted-foreground">
                    Couldn’t find a post with ID <span className="font-mono">{id}</span>.
                </p>
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <Button asChild>
                        <Link to="/">Home</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

/* ---------------- main page ---------------- */
export default function PostDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const fetchPost = useCallback(async () => {
        setLoading(true);
        setNotFound(false);
        try {
            const { post } = await getPostById(id);
            if (!post) setNotFound(true);
            else setPost(post);
        } catch (e) {
            if (e?.status === 404) setNotFound(true);
            else toast.error(e?.message || "Failed to load post");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchPost();
    }, [fetchPost]);

    const onDeleted = useCallback(() => {
        navigate("/", { replace: true });
    }, [navigate]);

    const title = useMemo(() => {
        if (post?.author?.username) {
            return `Post by @${post.author.username} • DevNexus`;
        }
        return "Post • DevNexus";
    }, [post]);

    const description = useMemo(() => {
        const t = (post?.text || "").replace(/\s+/g, " ").trim();
        return t.length > 140 ? `${t.slice(0, 140)}…` : t || "View post on DevNexus.";
    }, [post]);

    return (
        <div className="container max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <Meta title={title} description={description} image={post?.image?.url} />

            <div className="mb-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
            </div>

            {loading ? (
                <PostSkeleton />
            ) : notFound ? (
                <NotFoundBlock id={id} />
            ) : (
                <PostCard post={post} onDeleted={onDeleted} postDetailStatus={true} />
            )}
        </div>
    );
}
true