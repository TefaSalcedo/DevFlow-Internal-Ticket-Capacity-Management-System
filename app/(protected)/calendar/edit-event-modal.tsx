"use client";

import { useActionState, useMemo, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { type UpdateCalendarEventState, updateCalendarEventAction } from "./actions";

interface EventFormCompany {
  id: string;
  name: string;
}

interface EventFormMember {
  company_id: string;
  user_id: string;
  full_name: string;
}

interface EditEventModalProps {
  companies: EventFormCompany[];
  members: EventFormMember[];
  eventId: string;
  initialData: {
    companyId: string;
    title: string;
    date: string;
    startsAtTime: string;
    endsAtTime: string;
    participantIds: string[];
  };
  onClose: () => void;
}

const initialState: UpdateCalendarEventState = {};

export function EditEventModal({
  companies,
  members,
  eventId,
  initialData,
  onClose,
}: EditEventModalProps) {
  const [state, formAction] = useActionState(updateCalendarEventAction, initialState);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialData.companyId);

  const companyMembers = useMemo(() => {
    if (!selectedCompanyId) {
      return members;
    }
    return members.filter((member) => member.company_id === selectedCompanyId);
  }, [members, selectedCompanyId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planning</p>
            <h3 className="text-lg font-semibold text-slate-900">Edit Event</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <form action={formAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="eventId" value={eventId} />

          <div className="md:col-span-2">
            <label
              htmlFor="edit-event-company"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Company
            </label>
            <select
              id="edit-event-company"
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
            <label
              htmlFor="edit-event-title"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Event title
            </label>
            <input
              id="edit-event-title"
              name="title"
              required
              maxLength={120}
              defaultValue={initialData.title}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
              placeholder="Sprint planning / Delivery follow-up"
            />
          </div>

          <div>
            <label
              htmlFor="edit-event-date"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Date
            </label>
            <input
              id="edit-event-date"
              name="date"
              type="date"
              defaultValue={initialData.date}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="edit-event-start"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Start
              </label>
              <input
                id="edit-event-start"
                name="startsAtTime"
                type="time"
                defaultValue={initialData.startsAtTime}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
                required
              />
            </div>

            <div>
              <label
                htmlFor="edit-event-end"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                End
              </label>
              <input
                id="edit-event-end"
                name="endsAtTime"
                type="time"
                defaultValue={initialData.endsAtTime}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
                required
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="edit-event-participants"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Participants
            </label>
            <select
              id="edit-event-participants"
              name="participantIds"
              multiple
              defaultValue={initialData.participantIds}
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

          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <SubmitButton idleLabel="Save changes" busyLabel="Saving..." />
          </div>
        </form>
      </div>
    </div>
  );
}
