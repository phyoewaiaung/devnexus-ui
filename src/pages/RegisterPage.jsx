// src/pages/RegisterPage.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { uploadAvatar } from "../api/users";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// icons
import {
  Upload,
  User,
  Mail,
  Lock,
  AtSign,
  User2,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  LogIn,
  ImageUp,
} from "lucide-react";

// validation
const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Must include uppercase, lowercase, and a number"
    ),
});

export default function RegisterPage() {
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const nav = useNavigate();
  const { register: registerUser, login, refresh } = useAuth();

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", username: "", email: "", password: "" },
  });

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErr("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErr("Image must be less than 5MB");
        return;
      }
      setErr("");
    }
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
  };

  const onSubmit = async (data) => {
    setErr("");
    setBusy(true);
    try {
      // 1) create account
      await registerUser({
        name: data.name,
        username: data.username,
        email: data.email,
        password: data.password,
      });

      // 2) login to attach avatar
      const userKey = data.username || data.email;
      await login(userKey, data.password);

      // 3) optional avatar upload
      if (avatarFile) {
        await uploadAvatar(avatarFile);
      }

      // 4) refresh user data so avatar shows immediately
      try {
        await refresh();
      } catch (e) {
        console.error('Failed to refresh user after registration', e);
      }

      // 5) go home
      nav("/");
    } catch (error) {
      setErr(error?.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Join{" "}
            <span className="bg-gradient-to-r from-[#3C81D2] to-[#8B5CF6] bg-clip-text text-transparent">
              DevNexus
            </span>
          </h1>
          <p className="text-muted-foreground">
            Create your account to connect with developers worldwide
          </p>
        </div>

        <Card className="border border-border bg-card/90 text-card-foreground backdrop-blur p-6 rounded-xl shadow-lg relative overflow-hidden">
          {/* soft glows */}
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-28 size-72 rounded-full bg-secondary/30 blur-3xl" />

          <div className="relative z-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* avatar */}
                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="h-24 w-24 ring-1 ring-border">
                    <AvatarImage src={avatarPreview} />
                    <AvatarFallback>
                      <User className="h-12 w-12 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="relative">
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={onAvatarChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="inline-flex items-center cursor-pointer rounded-md border px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"
                    >
                      <ImageUp className="mr-2 h-4 w-4" />
                      Choose avatar
                    </label>
                  </div>
                </div>

                {/* name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <div className="relative">
                        <User2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <FormControl>
                          <Input placeholder="Jane Doe" className="pl-10" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* username */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <FormControl>
                          <Input placeholder="your_handle" className="pl-10" {...field} />
                        </FormControl>
                      </div>
                      <FormDescription>This will be your public @handle</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" className="pl-10" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <FormControl>
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a strong password"
                            className="pl-10 pr-12"
                            {...field}
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      <FormDescription>
                        Must be 8+ characters including upper/lowercase and a number.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* error */}
                {err && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      <p className="text-sm">{err}</p>
                    </div>
                  </div>
                )}

                {/* submit */}
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      Create account
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* footer */}
            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  Sign in
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
