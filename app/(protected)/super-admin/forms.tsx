"use client";

import { useActionState } from "react";
import {
  type AdminActionState,
  assignMembershipAction,
  createCompanyAction,
} from "@/app/(protected)/super-admin/actions";
import { SubmitButton } from "@/components/ui/submit-button";

interface SuperAdminFormsProps {
  companies: Array<{
    id: string;
    name: string;
  }>;
}

const initialState: AdminActionState = {};

export function SuperAdminForms({ companies }: SuperAdminFormsProps) {
  const [companyState, companyAction] = useActionState(createCompanyAction, initialState);
  const [membershipState, membershipAction] = useActionState(assignMembershipAction, initialState);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form
        action={companyAction}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-slate-900">Create company</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
              placeholder="Acme Corporation"
            />
          </div>
          <div>
            <label htmlFor="slug" className="mb-1 block text-sm font-medium text-slate-700">
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
              placeholder="acme-corp"
            />
          </div>

          {companyState.error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {companyState.error}
            </p>
          )}
          {companyState.success && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {companyState.success}
            </p>
          )}

          <SubmitButton idleLabel="Create company" busyLabel="Creating..." />
        </div>
      </form>

      <form
        action={membershipAction}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 className="text-lg font-semibold text-slate-900">Assign membership</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="companyId" className="mb-1 block text-sm font-medium text-slate-700">
              Company
            </label>
            <select
              id="companyId"
              name="companyId"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
            >
              <option value="" disabled>
                Select company
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="userEmail" className="mb-1 block text-sm font-medium text-slate-700">
              User email
            </label>
            <input
              id="userEmail"
              name="userEmail"
              type="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
              placeholder="member@company.com"
            />
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
              Company role
            </label>
            <select
              id="role"
              name="role"
              defaultValue="READER"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
            >
              <option value="COMPANY_ADMIN">COMPANY_ADMIN</option>
              <option value="TICKET_CREATOR">TICKET_CREATOR</option>
              <option value="READER">READER</option>
            </select>
          </div>

          {membershipState.error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {membershipState.error}
            </p>
          )}
          {membershipState.success && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {membershipState.success}
            </p>
          )}

          <SubmitButton idleLabel="Assign membership" busyLabel="Assigning..." />
        </div>
      </form>
    </div>
  );
}
