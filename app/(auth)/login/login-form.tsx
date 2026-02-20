"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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

    if (mode === "sign-in") {
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
    setMode("sign-in");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          placeholder="••••••••"
        />
      </div>

      {mode === "sign-up" && (
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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Processing..." : mode === "sign-in" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => {
          setError(null);
          setNotice(null);
          setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
        }}
        className="w-full text-sm text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline"
      >
        {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
