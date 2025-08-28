// src/pages/LoginPage.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// icons
import {
  LogIn,
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";

// validation
const loginSchema = z.object({
  usernameOrEmail: z
    .string()
    .min(1, "Username or email is required")
    .refine((val) => {
      const isEmail = val.includes("@");
      return isEmail ? z.string().email().safeParse(val).success : val.length >= 3;
    }, "Please enter a valid email or username"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const nav = useNavigate();
  const { login } = useAuth();

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { usernameOrEmail: "", password: "" },
  });

  const onSubmit = async (data) => {
    setErr("");
    setBusy(true);
    try {
      await login(data.usernameOrEmail, data.password);
      nav("/");
    } catch (error) {
      setErr(error?.message || "Login failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 flex h-full items-center justify-center">
      <div className="w-full max-w-md">
        {/* header */}
        <div className="text-center mb-8">
          {/* <img src="/src/assets/transparent.png" alt="DevNexus" className="w-[20vw] h-[10vw] object-contain mx-auto" /> */}
          <h1 className="text-3xl font-bold mb-2">
            Welcome back to{" "}
            <span className="bg-gradient-to-r from-[#3C81D2] to-[#8B5CF6] bg-clip-text text-transparent">
              DevNexus
            </span>
          </h1>
          <p className="text-muted-foreground">Sign in to connect with developers worldwide</p>
        </div>

        {/* card */}
        <Card className="border border-border bg-card/90 text-card-foreground backdrop-blur p-6 rounded-xl shadow-lg">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* username or email */}
            <div>
              <label className="block text-sm font-medium mb-2">Username or Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter username or email"
                  className={`pl-10 ${form.formState.errors.usernameOrEmail ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  {...form.register("usernameOrEmail")}
                />
              </div>
              {form.formState.errors.usernameOrEmail && (
                <p className="mt-1 text-sm text-destructive flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {form.formState.errors.usernameOrEmail.message}
                </p>
              )}
            </div>

            {/* password */}
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className={`pl-10 pr-12 ${form.formState.errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="mt-1 text-sm text-destructive flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* forgot link */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>

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
            <Button type="submit" disabled={busy} className="w-full gap-2">
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  Sign in
                </>
              )}
            </Button>
          </form>

          {/* footer */}
          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Don’t have an account?{" "}
              <Link
                to="/register"
                className="text-primary hover:underline inline-flex items-center"
              >
                Create account
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
