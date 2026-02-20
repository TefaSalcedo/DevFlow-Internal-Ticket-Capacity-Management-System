import type { Metadata } from "next";

import { LoginForm } from "@/app/(auth)/login/login-form";

export const metadata: Metadata = {
  title: "Login | FlowBoard Internal",
  description: "Secure access for ticket and team capacity management",
};

interface LoginPageProps {
  searchParams: Promise<{
    invite?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const inviteToken = typeof params.invite === "string" ? params.invite : undefined;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(2,132,199,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(15,118,110,0.12),transparent_30%)]" />
      <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          TaskFlow Corporate
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to continue managing tickets and team capacity. New accounts are provisioned by
          invite.
        </p>

        <div className="mt-8">
          <LoginForm inviteToken={inviteToken} />
        </div>
      </section>
    </main>
  );
}
