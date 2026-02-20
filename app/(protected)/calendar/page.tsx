import { format } from "date-fns";

import { getAuthContext } from "@/lib/auth/session";
import { getMeetings } from "@/lib/data/queries";

export default async function CalendarPage() {
  const auth = await getAuthContext();
  const meetings = await getMeetings(auth);

  const grouped = meetings.reduce<Record<string, typeof meetings>>((acc, meeting) => {
    const key = format(new Date(meeting.starts_at), "yyyy-MM-dd");
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(meeting);
    return acc;
  }, {});

  const dayKeys = Object.keys(grouped).sort((a, b) => (a < b ? -1 : 1));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planning</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Calendar</h2>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {dayKeys.length === 0 ? (
          <p className="text-sm text-slate-500">No meetings available for your scope.</p>
        ) : (
          <div className="space-y-6">
            {dayKeys.map((day) => (
              <article key={day}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {day}
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {grouped[day].map((meeting) => (
                    <div
                      key={meeting.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">{meeting.title}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {format(new Date(meeting.starts_at), "HH:mm")} -{" "}
                        {format(new Date(meeting.ends_at), "HH:mm")}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Participants: {meeting.participants.length}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
