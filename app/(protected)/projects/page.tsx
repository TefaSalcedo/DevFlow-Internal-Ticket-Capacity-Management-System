import { Folder, PauseCircle, PlayCircle } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth/session";
import { getCompaniesForUser, getProjects } from "@/lib/data/queries";

function projectTone(status: string) {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "PAUSED") {
    return "warning";
  }

  return "neutral";
}

export default async function ProjectsPage() {
  const auth = await getAuthContext();
  const companies = await getCompaniesForUser(auth);
  const projectsByCompany = await Promise.all(
    companies.map((company) => {
      return getProjects(auth, company.id);
    })
  );
  const projects = projectsByCompany
    .flat()
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  const canCreateProjects =
    auth.isSuperAdmin ||
    auth.memberships.some(
      (membership) =>
        membership.company_id === auth.activeCompanyId && membership.role === "COMPANY_ADMIN"
    );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Portfolio
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Projects</h2>
        </div>

        {canCreateProjects && (
          <Link
            href="/projects/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            + New Project
          </Link>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 ? (
          <article className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-500 sm:col-span-2 xl:col-span-3">
            No projects found for your current tenant scope.
          </article>
        ) : (
          projects.map((project) => (
            <article
              key={project.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{project.code}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{project.name}</h3>
                </div>
                <StatusBadge label={project.status} tone={projectTone(project.status)} />
              </div>

              <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
                <Folder className="size-4" />
                <span>Created at {new Date(project.created_at).toLocaleDateString()}</span>
              </div>

              <div className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
                {project.status === "ACTIVE" ? (
                  <PlayCircle className="size-3.5" />
                ) : (
                  <PauseCircle className="size-3.5" />
                )}
                <span>Lifecycle status</span>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
