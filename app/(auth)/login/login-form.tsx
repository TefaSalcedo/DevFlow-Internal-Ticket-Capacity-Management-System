"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface LoginFormProps {
  inviteToken?: string;
}

const REMEMBER_ME_KEY = "devflow-remember-me";
const REMEMBERED_EMAIL_KEY = "devflow-remembered-email";

function mapResetPasswordErrorMessage(rawMessage: string) {
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.includes("rate limit")) {
    return "We have sent too many recovery emails. Please wait 3 minutes and try again.";
  }

  return rawMessage;
}

function mapSignUpErrorMessage(rawMessage: string) {
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.includes("rate limit")) {
    return "We have sent too many signup emails. Please wait 3 minutes and try again.";
  }

  return rawMessage;
}

export function LoginForm({ inviteToken }: LoginFormProps) {
  const isInviteSignUp = Boolean(inviteToken);
  const isStandardLogin = !isInviteSignUp;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const router = useRouter();
  const nextPath = "/dashboard";

  useEffect(() => {
    const rememberPreference = window.localStorage.getItem(REMEMBER_ME_KEY);
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);

    if (rememberPreference === "false") {
      setRememberMe(false);
    }

    if (rememberedEmail) {
      setEmail(rememberedEmail);
    }
  }, []);

  function persistRememberPreference() {
    if (rememberMe) {
      window.localStorage.setItem(REMEMBER_ME_KEY, "true");
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
      return;
    }

    window.localStorage.setItem(REMEMBER_ME_KEY, "false");
    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient({ persistSession: rememberMe });

    if (isForgotPasswordMode) {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: emailExists, error: emailExistsError } = await supabase.rpc(
        "email_exists_for_login",
        {
          input_email: normalizedEmail,
        }
      );

      if (emailExistsError) {
        setError("Unable to validate the email address right now. Please try again.");
        setLoading(false);
        return;
      }

      if (!emailExists) {
        setError("Please contact the administrator for your password to create an account.");
        setLoading(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(mapResetPasswordErrorMessage(resetError.message));
        setLoading(false);
        return;
      }

      setNotice("Password recovery email sent. Check your inbox to continue.");
      setLoading(false);
      return;
    }

    if (isStandardLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      persistRememberPreference();
      router.push(nextPath);
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          invite_token: inviteToken ?? null,
        },
      },
    });

    if (signUpError) {
      setError(mapSignUpErrorMessage(signUpError.message));
      setLoading(false);
      return;
    }

    if (data.session) {
      persistRememberPreference();
      router.push(nextPath);
      router.refresh();
      return;
    }

    setNotice("Account created. Check your email confirmation settings or sign in directly.");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {inviteToken && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          You are joining through a company invite. Create your account to continue.
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          placeholder="name@company.com"
        />
      </div>

      {!isForgotPasswordMode && (
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required={isStandardLogin}
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-11 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      )}

      {isInviteSignUp && (
        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
            placeholder="Alex Rivers"
          />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      {isStandardLogin && (
        <div className="space-y-2 text-sm">
          <label className="inline-flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-4 rounded border border-slate-300 text-blue-600"
            />
            Remember me
          </label>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setIsForgotPasswordMode((previous) => !previous);
                setError(null);
                setNotice(null);
              }}
              className="font-medium text-blue-700 transition hover:text-blue-900"
            >
              {isForgotPasswordMode ? "Back to sign in" : "Forgot password?"}
            </button>

            {isForgotPasswordMode && (
              <span className="text-slate-500">Enter your email to recover your password.</span>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Processing..."
          : isForgotPasswordMode
            ? "Send recovery email"
            : isInviteSignUp
              ? "Create account"
              : "Sign in"}
      </button>
    </form>
  );
}
