// src/pages/EditProfilePage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, updateMe, uploadAvatar } from "../api/users";

// shadcn/ui
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// form + validation
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// icons
import {
  Loader2,
  ImageUp,
  User as UserIcon,
  Globe,
  Github,
  Twitter,
  Linkedin,
  AtSign,
} from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  bio: z.string().max(280, "Bio can be up to 280 characters").optional().default(""),
  skills: z.string().optional().default(""), // comma-separated
  website: z
    .string()
    .optional()
    .transform(v => (v ?? "").trim())
    .refine(v => !v || isLikelyUrl(v), "Enter a valid URL"),
  github: z.string().optional().default(""),
  twitter: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
});

function isLikelyUrl(v) {
  if (!v) return true;
  try {
    // allow urls without protocol (we’ll normalize before save)
    new URL(v.startsWith("http") ? v : `https://${v}`);
    return true;
  } catch {
    return false;
  }
}
const normalizeUrl = v => (!v ? "" : v.startsWith("http") ? v : `https://${v}`);

export default function EditProfilePage() {
  const nav = useNavigate();

  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      bio: "",
      skills: "",
      website: "",
      github: "",
      twitter: "",
      linkedin: "",
    },
    mode: "onChange",
  });

  // Load user
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { user } = await getMe();
        if (!alive) return;
        form.reset({
          name: user.name || "",
          bio: user.bio || "",
          skills: Array.isArray(user.skills) ? user.skills.join(", ") : user.skills || "",
          website: user.socialLinks?.website || "",
          github: user.socialLinks?.github || "",
          twitter: user.socialLinks?.twitter || "",
          linkedin: user.socialLinks?.linkedin || "",
        });
        setAvatarPreview(user.avatarUrl || "");
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load profile");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Skills preview chips
  const skillChips = useMemo(() => {
    return form.watch("skills")
      ?.split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 12);
  }, [form.watch("skills")]);

  const bioChars = (form.watch("bio") || "").length;

  const onAvatarChange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image must be less than 5MB");
      return;
    }
    try {
      const localURL = URL.createObjectURL(file);
      setAvatarPreview(localURL);
      const { avatarUrl } = await uploadAvatar(file);
      setAvatarPreview(avatarUrl);
    } catch (error) {
      setErr(error?.message || "Avatar upload failed");
    }
  };

  const onSubmit = async values => {
    setErr("");
    setSaving(true);
    try {
      await updateMe({
        name: values.name,
        bio: values.bio || "",
        skills: values.skills || "", // backend splits by comma
        socialLinks: {
          website: normalizeUrl(values.website),
          github: values.github?.trim() || "",
          twitter: values.twitter?.trim() || "",
          linkedin: values.linkedin?.trim() || "",
        },
      });
      nav(-1);
    } catch (error) {
      setErr(error?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading profile…</span>
        </div>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header / actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Edit profile</h2>
            <p className="text-sm text-muted-foreground">
              Update your public info and social links.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => nav(-1)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.formState.isDirty || !form.formState.isValid || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>

        {err && (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Avatar */}
            <div className="md:col-span-4">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarPreview} />
                  <AvatarFallback>
                    <UserIcon className="h-10 w-10 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onAvatarChange}
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="inline-flex items-center cursor-pointer rounded-md border px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"
                  >
                    <ImageUp className="mr-2 h-4 w-4" />
                    Change avatar
                  </label>
                </div>

                <p className="text-xs text-muted-foreground">PNG/JPG up to 5MB.</p>
              </div>
            </div>

            {/* Right: Form fields */}
            <div className="md:col-span-8 space-y-5">
              {/* Basics */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Tell the community about you…" {...field} />
                      </FormControl>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Max 280 characters</span>
                        <span className="text-xs text-muted-foreground">{bioChars}/280</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skills</FormLabel>
                      <FormControl>
                        <Input placeholder="react, node, devops" {...field} />
                      </FormControl>
                      {!!skillChips?.length && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {skillChips.map((s, i) => (
                            <Badge key={`${s}-${i}`} variant="secondary" className="font-normal">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Comma-separated. Shown as tags on your profile.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Social links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input placeholder="yourdomain.com" className="pl-9" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="github"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub</FormLabel>
                      <div className="relative">
                        <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input placeholder="github.com/yourname" className="pl-9" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="twitter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twitter/X</FormLabel>
                      <div className="relative">
                        <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input placeholder="twitter.com/handle" className="pl-9" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="linkedin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn</FormLabel>
                      <div className="relative">
                        <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input placeholder="linkedin.com/in/you" className="pl-9" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Bottom actions for small screens (extra accessible) */}
        <div className="flex items-center justify-end gap-2 md:hidden">
          <Button type="button" variant="outline" onClick={() => nav(-1)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!form.formState.isDirty || !form.formState.isValid || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
