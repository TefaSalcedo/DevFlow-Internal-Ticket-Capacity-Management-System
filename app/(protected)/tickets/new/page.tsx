import { getAuthContext } from "@/lib/auth/session";
import { getCompaniesForUser, getProjects, getTeamWorkload } from "@/lib/data/queries";

import { TicketForm } from "./ticket-form";

export default async function NewTicketPage() {
  const auth = await getAuthContext();
  const [companies, projects, members] = await Promise.all([
    getCompaniesForUser(auth),
    getProjects(auth),
    getTeamWorkload(auth),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Ticketing
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Create New Ticket</h2>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <TicketForm
          companies={companies.map((company) => ({ id: company.id, name: company.name }))}
          projects={projects.map((project) => ({
            id: project.id,
            code: project.code,
            name: project.name,
          }))}
          members={members.map((member) => ({ userId: member.userId, fullName: member.fullName }))}
          defaultCompanyId={auth.activeCompanyId ?? undefined}
        />
      </section>
    </div>
  );
}
