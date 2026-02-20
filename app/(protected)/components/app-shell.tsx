import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  Shield,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/app/(protected)/actions/sign-out";
import type { AuthContext } from "@/lib/auth/session";

interface AppShellProps {
  auth: AuthContext;
  children: React.ReactNode;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/team", label: "Team", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/super-admin", label: "Super Admin", icon: Shield },
];

export function AppShell({ auth, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <aside className="w-full border-b border-slate-200 bg-slate-900 text-white md:w-72 md:border-b-0 md:border-r md:border-slate-800">
          <div className="px-5 py-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Internal SaaS</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">FlowBoard</h1>
            <p className="mt-1 text-sm text-slate-300">Ticket & Capacity Control</p>
          </div>

          <nav className="grid grid-cols-2 gap-2 px-4 pb-5 md:grid-cols-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-4 pb-5">
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Signed in as</p>
                <p className="text-sm font-medium text-slate-800">
                  {auth.profile.full_name} · {auth.profile.global_role}
                </p>
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
