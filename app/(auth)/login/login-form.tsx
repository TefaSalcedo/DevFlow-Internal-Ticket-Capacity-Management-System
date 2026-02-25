"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface LoginFormProps {
  inviteToken?: string;
}

function mapResetPasswordErrorMessage(rawMessage: string) {
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.includes("rate limit")) {
    return "We have sent too many recovery emails. Please wait 60 seconds and try again.";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const router = useRouter();
  const nextPath = "/dashboard";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();

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
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
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
          <input
            id="password"
            name="password"
            type="password"
            required={isStandardLogin}
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
            placeholder="••••••••"
          />
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
        <div className="flex items-center justify-between gap-3 text-sm">
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
