import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from "date-fns";
import Link from "next/link";

import { CalendarClient } from "@/app/(protected)/calendar/calendar-client";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthContext } from "@/lib/auth/session";
import {
  getCalendarMembers,
  getCalendarTickets,
  getCompaniesForUser,
  getMeetings,
} from "@/lib/data/queries";
import type { TicketWorkflowStage } from "@/lib/types/domain";

function stageLabel(workflowStage: TicketWorkflowStage) {
  if (workflowStage === "NEW") {
    return "New";
  }

  if (workflowStage === "ANALYSIS") {
    return "Analysis";
  }

  if (workflowStage === "RESEARCH") {
    return "Research";
  }

  if (workflowStage === "SUPPORT") {
    return "Support";
  }

  if (workflowStage === "DESIGN") {
    return "Design";
  }

  if (workflowStage === "BUG") {
    return "Bug";
  }

  if (workflowStage === "PR_REVIEW") {
    return "PR Review";
  }

  if (workflowStage === "QA") {
    return "QA";
  }

  if (workflowStage === "ADMIN") {
    return "Admin";
  }

  if (workflowStage === "MEETING") {
    return "Meeting";
  }

  return "DEV";
}

function statusTone(status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE") {
  if (status === "DONE") {
    return "success" as const;
  }

  if (status === "BLOCKED") {
    return "danger" as const;
  }

  if (status === "ACTIVE") {
    return "info" as const;
  }

  return "neutral" as const;
}

function priorityTone(priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT") {
  if (priority === "URGENT") {
    return "danger" as const;
  }

  if (priority === "HIGH") {
    return "warning" as const;
  }

  if (priority === "LOW") {
    return "neutral" as const;
  }

  return "info" as const;
}

function timelineBarColor(status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE") {
  if (status === "DONE") {
    return "#059669";
  }

  if (status === "BLOCKED") {
    return "#dc2626";
  }

  if (status === "ACTIVE") {
    return "#2563eb";
  }

  return "#64748b";
}

interface TimelineTicketItem {
  id: string;
  title: string;
  status: "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  created_at: string;
  due_date: string;
  leftPercent: number;
  widthPercent: number;
}

interface CalendarPageProps {
  searchParams: Promise<{
    week?: string;
    ganttStatus?: string;
    ganttSort?: string;
    ganttView?: string;
  }>;
}

type GanttStatusFilter = "ALL" | "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE";
type GanttSortOption = "CREATED_ASC" | "CREATED_DESC";
type GanttViewOption = "CURRENT" | "FULL" | "30D";

function normalizeGanttStatus(value?: string): GanttStatusFilter {
  const normalized = (value ?? "").toUpperCase();
  if (["ALL", "BACKLOG", "ACTIVE", "BLOCKED", "DONE"].includes(normalized)) {
    return normalized as GanttStatusFilter;
  }
  return "ACTIVE";
}

function normalizeGanttSort(value?: string): GanttSortOption {
  const normalized = (value ?? "").toUpperCase();
  if (normalized === "CREATED_DESC") {
    return "CREATED_DESC";
  }
  return "CREATED_ASC";
}

function normalizeGanttView(value?: string): GanttViewOption {
  const normalized = (value ?? "").toUpperCase();
  if (normalized === "30D") return "30D";
  if (normalized === "FULL") return "FULL";
  return "CURRENT";
}

function normalizeWeek(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function formatWeekParam(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function buildCalendarHref(input: {
  week: Date;
  ganttStatus: GanttStatusFilter;
  ganttSort: GanttSortOption;
  ganttView: GanttViewOption;
}) {
  const params = new URLSearchParams();
  params.set("week", formatWeekParam(input.week));
  params.set("ganttStatus", input.ganttStatus);
  params.set("ganttSort", input.ganttSort);
  params.set("ganttView", input.ganttView);
  return `/calendar?${params.toString()}`;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const auth = await getAuthContext();
  const [meetings, tickets, members, companies] = await Promise.all([
    getMeetings(auth),
    getCalendarTickets(auth),
    getCalendarMembers(auth),
    getCompaniesForUser(auth),
  ]);

  return (
    <CalendarClient
      auth={auth}
      meetings={meetings}
      tickets={tickets}
      members={members}
      companies={companies}
      searchParams={params}
    />
  );
}
