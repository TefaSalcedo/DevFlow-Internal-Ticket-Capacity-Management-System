"use client";

import { useState } from "react";

import { CalendarEventForm } from "@/app/(protected)/calendar/event-form";

interface EventFormCompany {
  id: string;
  name: string;
}

interface EventFormMember {
  company_id: string;
  user_id: string;
  full_name: string;
}

interface CreateEventModalProps {
  companies: EventFormCompany[];
  members: EventFormMember[];
  defaultCompanyId?: string;
}

export function CreateEventModal({ companies, members, defaultCompanyId }: CreateEventModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Create event
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Planning
                </p>
                <h3 className="text-lg font-semibold text-slate-900">Create Event</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <CalendarEventForm
              companies={companies}
              members={members}
              defaultCompanyId={defaultCompanyId}
            />
          </div>
        </div>
      )}
    </>
  );
}
