export type GlobalRole = "SUPER_ADMIN" | "USER";

export type CompanyRole = "COMPANY_ADMIN" | "MANAGE_TEAM" | "TICKET_CREATOR" | "READER";

export type ProjectStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type TicketStatus = "BACKLOG" | "ACTIVE" | "BLOCKED" | "DONE";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TicketWorkflowStage =
  | "NEW"
  | "ANALYSIS"
  | "RESEARCH"
  | "SUPPORT"
  | "DEVELOPMENT"
  | "DESIGN"
  | "QA"
  | "PR_REVIEW"
  | "BUG"
  | "ADMIN"
  | "MEETING";

export interface TicketAssignee {
  user_id: string;
  full_name: string;
}

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

export interface Team {
  id: string;
  company_id: string;
  name: string;
  capacity_default?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  company_id: string;
  team_id: string;
  name: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  company_id: string;
  team_id: string | null;
  board_id: string | null;
  requester_team_id?: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  cross_team_alert?: boolean;
  priority: TicketPriority;
  estimated_hours: number;
  due_date: string | null;
  done_at?: string | null;
  assigned_to: string | null;
  assignees?: TicketAssignee[];
  workflow_stage: TicketWorkflowStage;
  created_by: string;
  created_at: string;
  updated_at?: string;
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

export interface TeamActivityTicketItem {
  ticketId: string;
  title: string;
  status: TicketStatus;
  workflowStage: TicketWorkflowStage;
  priority: TicketPriority;
  createdAt: string;
  lastMovementAt: string | null;
  inactiveDays: number;
  isCritical: boolean;
}

export interface TeamActivityMovementItem {
  historyId: string;
  ticketId: string;
  ticketTitle: string;
  fieldName: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

export interface TeamWeeklyMemberActivity {
  userId: string;
  fullName: string;
  weeklyCapacity: number;
  createdTickets: TeamActivityTicketItem[];
  assignedTickets: TeamActivityTicketItem[];
  movements: TeamActivityMovementItem[];
  createdCount: number;
  assignedCount: number;
  movementCount: number;
  criticalAssignedCount: number;
  averageInactiveDays: number;
  productivityRatio: number;
}

export interface TeamWeeklyActivitySnapshot {
  weekStart: string;
  weekEnd: string;
  members: TeamWeeklyMemberActivity[];
  totals: {
    createdTickets: number;
    assignedTickets: number;
    movements: number;
    criticalAssigned: number;
    averageInactiveDays: number;
  };
}
