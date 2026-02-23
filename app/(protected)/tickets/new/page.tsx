import { getAuthContext } from "@/lib/auth/session";
import {
  getCalendarMembers,
  getCompaniesForUser,
  getProjects,
  getTeamOptions,
} from "@/lib/data/queries";

import { TicketForm } from "./ticket-form";

export default async function NewTicketPage() {
  const auth = await getAuthContext();
  const [companies, projects, members, teams] = await Promise.all([
    getCompaniesForUser(auth),
    getProjects(auth),
    getCalendarMembers(auth),
    getTeamOptions(auth),
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
            companyId: project.company_id,
            code: project.code,
            name: project.name,
          }))}
          members={members.map((member) => ({
            userId: member.user_id,
            fullName: member.full_name,
            companyId: member.company_id,
          }))}
          teams={teams.map((team) => ({
            id: team.id,
            companyId: team.company_id,
            name: team.name,
          }))}
          defaultCompanyId={auth.activeCompanyId ?? undefined}
        />
      </section>
    </div>
  );
}
