"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "password" | "error">("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (!tokenHash || !type) {
      setStatus("error");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    // Verify the OTP token from the invite link
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: type as any })
      .then(({ error }: { error: Error | null }) => {
        if (error) {
          setError(error.message);
          setStatus("error");
          return;
        }

        if (type === "invite") {
          setStatus("password");
        } else {
          router.push("/dashboard");
        }
      });
  }, [searchParams, router]);

  async function assignToCompanyAndTeam(userId: string) {
    const companyId = searchParams.get("company");
    const teamId = searchParams.get("team");
    if (!companyId) return;

    const supabase = createSupabaseBrowserClient();

    await supabase.from("company_memberships").insert({
      company_id: companyId,
      user_id: userId,
      role: "READER",
      is_active: true,
    });

    if (teamId) {
      await supabase.from("team_members").insert({
        team_id: teamId,
        company_id: companyId,
        user_id: userId,
        is_active: true,
      });
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await assignToCompanyAndTeam(data.user.id);
    }

    router.push("/dashboard");
  }

  if (status === "loading") {
    return (
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <p className="mt-4 text-sm text-slate-600">Verifying your invite link...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Invalid or expired link</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error ?? "This link is invalid or has expired. Please request a new invite."}
        </p>
        <a
          href="/login"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Go to login
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Set your password</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your invite was accepted. Set a password to complete your account setup.
      </p>

      <form onSubmit={handleSetPassword} className="mt-6 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Setting password..." : "Complete setup"}
        </button>
      </form>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(2,132,199,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(15,118,110,0.12),transparent_30%)]" />
      <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          TaskFlow Corporate
        </p>
        <div className="mt-6">
          <Suspense
            fallback={
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              </div>
            }
          >
            <ConfirmContent />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
