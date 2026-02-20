import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth/session";
import { getSuperAdminSnapshot } from "@/lib/data/queries";

import { SuperAdminForms } from "./forms";

export default async function SuperAdminPage() {
  const auth = await getAuthContext();

  if (!auth.isSuperAdmin) {
    redirect("/dashboard");
  }

  const data = await getSuperAdminSnapshot(auth);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Global administration
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Super Admin Panel</h2>
      </header>

      <SuperAdminForms
        companies={data.companies.map((company) => ({ id: company.id, name: company.name }))}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Company directory</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.companies.map((company) => (
                <tr key={company.id}>
                  <td className="py-3 pr-3 font-medium text-slate-900">{company.name}</td>
                  <td className="py-3 pr-3 text-slate-600">{company.slug}</td>
                  <td className="py-3 text-slate-600">
                    {new Date(company.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Membership assignments</h3>
        <div className="mt-3 space-y-2">
          {data.memberships.length === 0 ? (
            <p className="text-sm text-slate-500">No memberships assigned yet.</p>
          ) : (
            data.memberships.map((membership) => {
              const company = Array.isArray(membership.companies)
                ? (membership.companies[0] ?? null)
                : (membership.companies ?? null);

              return (
                <div
                  key={membership.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="text-sm text-slate-700">
                    {company?.name ?? "Unknown company"} · {membership.user_id}
                  </p>
                  <StatusBadge label={membership.role} tone="info" />
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
