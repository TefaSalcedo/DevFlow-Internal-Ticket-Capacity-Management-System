import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up | FlowBoard Internal",
  description: "Create your account and join the team",
};

interface SignupPageProps {
  searchParams: Promise<{
    company?: string;
    team?: string;
    role?: string;
  }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const companyId = typeof params.company === "string" ? params.company : undefined;
  const teamId = typeof params.team === "string" ? params.team : undefined;
  const role = typeof params.role === "string" ? params.role : "READER";

  if (!companyId) {
    redirect("/");
  }

  // Check if user is already authenticated
  const auth = await getAuthContext();
  if (auth.user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(2,132,199,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(15,118,110,0.12),transparent_30%)]" />
        <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            TaskFlow Corporate
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Already logged in
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            You are already signed in as {auth.profile.full_name}. To create a new account, please
            sign out first.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              href="/dashboard"
              className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Go to Dashboard
            </a>
            <a
              href="/login"
              className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign Out
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(2,132,199,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(15,118,110,0.12),transparent_30%)]" />
      <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          TaskFlow Corporate
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Create account
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Join the team and start collaborating on tickets and projects.
        </p>

        <div className="mt-8">
          <SignupForm companyId={companyId} teamId={teamId} role={role} />
        </div>
      </section>
    </main>
  );
}
