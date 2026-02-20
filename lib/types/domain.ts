export type GlobalRole = "SUPER_ADMIN" | "USER";

export type CompanyRole = "COMPANY_ADMIN" | "TICKET_CREATOR" | "READER";

export type ProjectStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type TicketStatus = "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  global_role: GlobalRole;
  weekly_capacity_hours: number;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Membership {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  is_active: boolean;
  companies?:
    | {
        name: string;
        slug: string;
      }
    | Array<{
        name: string;
        slug: string;
      }>
    | null;
}

export interface Project {
  id: string;
  company_id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  created_at: string;
}

export interface Ticket {
  id: string;
  company_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  estimated_hours: number;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  company_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  participants: string[];
}

export interface TeamWorkloadItem {
  userId: string;
  fullName: string;
  role: CompanyRole;
  weeklyCapacity: number;
  assignedHours: number;
  meetingHours: number;
  remaining: number;
}
