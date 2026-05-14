"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderKanban,
  LayoutDashboard,
  Shield,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { signOutAction } from "@/app/(protected)/actions/sign-out";
import { SidebarTicketFiltersSlot } from "@/app/(protected)/components/sidebar-ticket-filters-slot";
import type { AuthContext } from "@/lib/auth/session";

interface AppShellProps {
  auth: AuthContext;
  children: React.ReactNode;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

const fullNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/team", label: "Team", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export function AppShell({ auth, children }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  function toggleCollapsed() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  const canViewTeamActivity =
    auth.profile.global_role === "SUPER_ADMIN" ||
    auth.memberships.some((membership) =>
      ["MANAGE_TEAM", "COMPANY_ADMIN"].includes(membership.role)
    );

  const canViewSales =
    auth.profile.global_role === "SUPER_ADMIN" ||
    auth.memberships.some((membership) => ["READER", "COMPANY_ADMIN"].includes(membership.role));

  // READER users get simplified navigation without Tickets option
  const isReaderOnly =
    auth.memberships.some((membership) => membership.role === "READER") &&
    !auth.memberships.some((membership) =>
      ["COMPANY_ADMIN", "MANAGE_TEAM", "TICKET_CREATOR", "SUPER_ADMIN"].includes(membership.role)
    );

  const baseNavItems = isReaderOnly ? navItems : fullNavItems;

  const visibleNavItems =
    auth.profile.global_role === "SUPER_ADMIN"
      ? [...baseNavItems, { href: "/super-admin", label: "Super Admin", icon: Shield }]
      : baseNavItems;

  const withSalesItems = canViewSales
    ? [...visibleNavItems, { href: "/sales", label: "Gestión de tareas", icon: Eye }]
    : visibleNavItems;

  const finalNavItems = canViewTeamActivity
    ? [...withSalesItems, { href: "/team-activity", label: "Team Activity", icon: Activity }]
    : withSalesItems;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <aside
          data-collapsed={isCollapsed}
          className={`border-b border-slate-200 bg-slate-900 text-white transition-all duration-300 md:border-b-0 md:border-r md:border-slate-800 md:sticky md:top-0 md:h-screen md:overflow-y-auto ${
            isCollapsed ? "w-full md:w-16" : "w-full md:w-72"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-6">
            {!isCollapsed && (
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Internal SaaS</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">FlowBoard</h1>
                <p className="mt-1 text-sm text-slate-300">Ticket & Capacity Control</p>
              </div>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden md:flex rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="size-5" />
              ) : (
                <ChevronLeft className="size-5" />
              )}
            </button>
          </div>

          <nav className="grid grid-cols-2 gap-2 px-4 pb-5 md:grid-cols-1">
            {finalNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 ${
                    isCollapsed ? "justify-center" : "gap-2"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {!isCollapsed && <SidebarTicketFiltersSlot />}

          <div className="px-4 pb-5">
            <form action={signOutAction}>
              <button
                type="submit"
                className={`w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 ${
                  isCollapsed ? "px-0" : ""
                }`}
                title={isCollapsed ? "Sign out" : undefined}
              >
                {isCollapsed ? <ChevronRight className="mx-auto size-5 rotate-180" /> : "Sign out"}
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="flex rounded-lg border border-slate-300 p-2 text-slate-700 transition hover:bg-slate-100 md:hidden"
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-5" />
                  ) : (
                    <ChevronLeft className="size-5" />
                  )}
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Signed in as</p>
                  <p className="text-sm font-medium text-slate-800">
                    {auth.profile.full_name} · {auth.profile.global_role}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                <BarChart3 className="size-4" />
                <span>{auth.memberships.length} company memberships</span>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
