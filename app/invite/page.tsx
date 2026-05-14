import type { Metadata } from "next";

import { SignupForm } from "@/app/(auth)/signup/signup-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Invite | FlowBoard Internal",
  description: "Join the team via invite link",
};

interface InvitePageProps {
  searchParams: Promise<{ token?: string; company?: string; team?: string }>;
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const params = await searchParams;
  const { token, company, team } = params;

  let companyId: string | undefined;
  let teamId: string | undefined;
  let role: string = "READER";

  // Support new token-based format
  if (token) {
    const supabase = await createSupabaseServerClient();

    const { data: inviteLink, error } = await supabase
      .from("company_invite_links")
      .select("company_id, team_id, role, is_active, expires_at")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (error || !inviteLink) {
      return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(2,132,199,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(15,118,110,0.12),transparent_30%)]" />
          <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur">
            <h1 className="text-2xl font-semibold text-slate-900">Invalid invite link</h1>
            <p className="mt-2 text-sm text-slate-600">
              This invite link is invalid or has expired. Please contact your team administrator for
              a new link.
            </p>
          </section>
        </main>
      );
    }

    // Check if token is expired
    if (inviteLink.expires_at && new Date(inviteLink.expires_at) < new Date()) {
      return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(2,132,199,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(15,118,110,0.12),transparent_30%)]" />
          <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur">
            <h1 className="text-2xl font-semibold text-slate-900">Expired invite link</h1>
            <p className="mt-2 text-sm text-slate-600">
              This invite link has expired. Please contact your team administrator for a new link.
            </p>
          </section>
        </main>
      );
    }

    companyId = inviteLink.company_id;
    teamId = inviteLink.team_id || undefined;
    role = inviteLink.role;
  } else if (company) {
    // Support legacy company/team format (for backward compatibility)
    companyId = company;
    teamId = team || undefined;
    role = "READER";
  } else {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(2,132,199,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(15,118,110,0.12),transparent_30%)]" />
        <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur">
          <h1 className="text-2xl font-semibold text-slate-900">Invalid invite link</h1>
          <p className="mt-2 text-sm text-slate-600">
            This invite link is invalid. Please contact your team administrator for a new link.
          </p>
        </section>
      </main>
    );
  }

  // Render signup form directly
  if (!companyId) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.14),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(2,132,199,0.12),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(15,118,110,0.12),transparent_30%)]" />
        <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/10 backdrop-blur">
          <h1 className="text-2xl font-semibold text-slate-900">Invalid invite link</h1>
          <p className="mt-2 text-sm text-slate-600">
            This invite link is invalid. Please contact your team administrator for a new link.
          </p>
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
