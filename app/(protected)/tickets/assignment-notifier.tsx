"use client";

import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AssignmentNotifierProps {
  userId: string;
  companyId?: string | null;
}

interface ToastItem {
  id: string;
  message: string;
}

interface TicketAssignmentInsertRow {
  ticket_id: string;
  company_id: string;
  user_id: string;
}

interface TicketInsertRow {
  id: string;
  company_id: string;
  team_id: string | null;
  title: string;
  cross_team_alert: boolean;
  created_by: string;
}

export function AssignmentNotifier({ userId, companyId }: AssignmentNotifierProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notificationsSupported = useMemo(() => {
    return typeof window !== "undefined" && "Notification" in window;
  }, []);

  useEffect(() => {
    if (!notificationsSupported) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
  }, [notificationsSupported]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let isCancelled = false;

    async function subscribeToCrossTeamTickets() {
      const membershipQuery = supabase
        .from("team_members")
        .select("team_id, company_id")
        .eq("user_id", userId)
        .eq("is_active", true);

      const { data: teamRows } = companyId
        ? await membershipQuery.eq("company_id", companyId)
        : await membershipQuery;

      if (isCancelled) {
        return;
      }

      const teamIds = new Set(
        ((teamRows ?? []) as Array<{ team_id: string | null }>)
          .map((row) => String(row.team_id ?? ""))
          .filter((teamId) => teamId.length > 0)
      );

      if (teamIds.size === 0) {
        return;
      }

      const channel = supabase
        .channel(`cross-team-ticket:${userId}:${companyId ?? "all"}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tickets",
            filter: "cross_team_alert=eq.true",
          },
          (payload: RealtimePostgresInsertPayload<TicketInsertRow>) => {
            const newTicket = payload.new;
            if (!newTicket.cross_team_alert) {
              return;
            }

            if (companyId && String(newTicket.company_id ?? "") !== companyId) {
              return;
            }

            if (String(newTicket.created_by ?? "") === userId) {
              return;
            }

            const ticketTeamId = String(newTicket.team_id ?? "");
            if (!teamIds.has(ticketTeamId)) {
              return;
            }

            const message = `New cross-team task for your team: ${newTicket.title ?? "New ticket"}`;

            if (notificationsSupported && Notification.permission === "granted") {
              new Notification("DevFlow · Team Alert", {
                body: message,
                tag: `cross-team-${newTicket.id}`,
              });
              return;
            }

            const toastId = `cross-team-${newTicket.id}-${Date.now()}`;
            setToasts((current) => [...current, { id: toastId, message }]);
            window.setTimeout(() => {
              setToasts((current) => current.filter((toast) => toast.id !== toastId));
            }, 6000);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    let cleanup: (() => void) | undefined;
    subscribeToCrossTeamTickets().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      isCancelled = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, [companyId, notificationsSupported, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`ticket-assignment:${userId}:${companyId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_assignees",
          filter: `user_id=eq.${userId}`,
        },
        async (payload: RealtimePostgresInsertPayload<TicketAssignmentInsertRow>) => {
          const ticketId = String(payload.new.ticket_id ?? "");
          const payloadCompanyId = String(payload.new.company_id ?? "");

          if (!ticketId) {
            return;
          }

          if (companyId && payloadCompanyId !== companyId) {
            return;
          }

          const { data } = await supabase
            .from("tickets")
            .select("title")
            .eq("id", ticketId)
            .single();

          const ticketTitle = data?.title ?? "a new task";
          const message = `Assigned to you: ${ticketTitle}`;

          if (notificationsSupported && Notification.permission === "granted") {
            new Notification("DevFlow · New ticket", {
              body: message,
              tag: `ticket-${ticketId}`,
            });
            return;
          }

          const toastId = `${ticketId}-${Date.now()}`;
          setToasts((current) => [...current, { id: toastId, message }]);

          window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== toastId));
          }, 6000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, notificationsSupported, userId]);

  async function requestPermission() {
    if (!notificationsSupported) {
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  }

  return (
    <>
      {notificationsSupported && permission !== "granted" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              Enable browser notifications to receive native alerts when a ticket is assigned to
              you.
            </p>
            {permission === "default" ? (
              <button
                type="button"
                onClick={requestPermission}
                className="rounded-md border border-blue-300 bg-white px-2 py-1 font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Enable notifications
              </button>
            ) : (
              <span className="font-semibold">Blocked in browser settings</span>
            )}
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-lg"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
