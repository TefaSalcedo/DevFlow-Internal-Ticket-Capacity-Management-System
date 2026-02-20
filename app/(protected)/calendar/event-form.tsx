"use client";

import { useActionState, useMemo, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

import { type CreateCalendarEventState, createCalendarEventAction } from "./actions";

interface EventFormCompany {
  id: string;
  name: string;
}

interface EventFormMember {
  company_id: string;
  user_id: string;
  full_name: string;
}

interface CalendarEventFormProps {
  companies: EventFormCompany[];
  members: EventFormMember[];
  defaultCompanyId?: string;
}

const initialState: CreateCalendarEventState = {};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function CalendarEventForm({
  companies,
  members,
  defaultCompanyId,
}: CalendarEventFormProps) {
  const [state, formAction] = useActionState(createCalendarEventAction, initialState);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    defaultCompanyId ?? companies[0]?.id ?? ""
  );

  const companyMembers = useMemo(() => {
    if (!selectedCompanyId) {
      return members;
    }

    return members.filter((member) => member.company_id === selectedCompanyId);
  }, [members, selectedCompanyId]);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="event-company" className="mb-1 block text-sm font-medium text-slate-700">
          Company
        </label>
        <select
          id="event-company"
          name="companyId"
          value={selectedCompanyId}
          onChange={(event) => setSelectedCompanyId(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          required
        >
          <option value="">Select company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label htmlFor="event-title" className="mb-1 block text-sm font-medium text-slate-700">
          Event title
        </label>
        <input
          id="event-title"
          name="title"
          required
          maxLength={120}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          placeholder="Sprint planning / Delivery follow-up"
        />
      </div>

      <div>
        <label htmlFor="event-date" className="mb-1 block text-sm font-medium text-slate-700">
          Date
        </label>
        <input
          id="event-date"
          name="date"
          type="date"
          defaultValue={todayDate()}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="event-start" className="mb-1 block text-sm font-medium text-slate-700">
            Start
          </label>
          <input
            id="event-start"
            name="startsAtTime"
            type="time"
            defaultValue="09:00"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
            required
          />
        </div>

        <div>
          <label htmlFor="event-end" className="mb-1 block text-sm font-medium text-slate-700">
            End
          </label>
          <input
            id="event-end"
            name="endsAtTime"
            type="time"
            defaultValue="10:00"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
            required
          />
        </div>
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="event-participants"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Participants
        </label>
        <select
          id="event-participants"
          name="participantIds"
          multiple
          className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
        >
          {companyMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.full_name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Use Ctrl/Cmd + click to select multiple participants.
        </p>
      </div>

      {state.error && (
        <p className="md:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <div className="md:col-span-2 flex justify-end">
        <SubmitButton idleLabel="Create event" busyLabel="Creating..." />
      </div>
    </form>
  );
}
