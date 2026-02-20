import { getAuthContext } from "@/lib/auth/session";
import { getCompaniesForUser } from "@/lib/data/queries";

import { ProjectForm } from "./project-form";

export default async function NewProjectPage() {
  const auth = await getAuthContext();
  const companies = await getCompaniesForUser(auth);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Portfolio
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Create New Project</h2>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <ProjectForm
          companies={companies.map((company) => ({ id: company.id, name: company.name }))}
          defaultCompanyId={auth.activeCompanyId ?? undefined}
        />
      </section>
    </div>
  );
}
