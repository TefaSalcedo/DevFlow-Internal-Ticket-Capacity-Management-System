"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { assignTeamMemberAction, moveTeamMemberAction } from "./actions";
import { DisableMemberButton } from "./disable-member-button";

interface MemberInfo {
  userId: string;
  fullName: string;
  role: string;
  weeklyCapacity: number;
  assignedHours: number;
  meetingHours: number;
  remaining: number;
}

interface Team {
  id: string;
  company_id: string;
  name: string;
}

interface TeamBoardProps {
  companyId: string;
  companyName: string;
  teams: Team[];
  membersByTeam: Record<string, string[]>;
  memberInfoMap: Record<string, MemberInfo>;
  unassignedToAnyTeam: MemberInfo[];
  activeMembersList: Array<{ userId: string; fullName: string }>;
  currentUserId: string;
  isCompanyAdmin: boolean;
  canManageTeams: boolean;
}

interface DragState {
  userId: string;
  fromTeamId: string | null;
  memberLabel: string;
}

export function TeamBoard({
  companyId,
  companyName,
  teams,
  membersByTeam,
  memberInfoMap,
  unassignedToAnyTeam,
  activeMembersList,
  currentUserId,
  isCompanyAdmin,
  canManageTeams,
}: TeamBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragDataRef = useRef<DragState | null>(null);

  function handleDragStart(userId: string, fromTeamId: string | null, memberLabel: string) {
    const state: DragState = { userId, fromTeamId, memberLabel };
    dragDataRef.current = state;
    setDragging(state);
  }

  function handleDragEnd() {
    setDragging(null);
    setDropTarget(null);
    dragDataRef.current = null;
  }

  function handleDragOver(e: React.DragEvent, teamId: string) {
    e.preventDefault();
    setDropTarget(teamId);
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  function handleDrop(e: React.DragEvent, toTeamId: string) {
    e.preventDefault();
    setDropTarget(null);

    const drag = dragDataRef.current;
    if (!drag) return;
    if (drag.fromTeamId === toTeamId) {
      setDragging(null);
      dragDataRef.current = null;
      return;
    }

    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("userId", drag.userId);
    formData.set("toTeamId", toTeamId);

    startTransition(async () => {
      if (drag.fromTeamId) {
        // Move between teams
        formData.set("fromTeamId", drag.fromTeamId);
        await moveTeamMemberAction(formData);
      } else {
        // Assign from unassigned
        formData.set("teamId", toTeamId);
        await assignTeamMemberAction(formData);
      }
      router.refresh();
    });

    setDragging(null);
    dragDataRef.current = null;
  }

  function getMemberLabel(userId: string) {
    return memberInfoMap[userId]?.fullName ?? userId;
  }

  function getMemberRole(userId: string) {
    return memberInfoMap[userId]?.role ?? null;
  }

  return (
    <div className={isPending ? "pointer-events-none opacity-60" : undefined}>
      <section className="grid gap-4 lg:grid-cols-2">
        {teams.length === 0 ? (
          <article className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 lg:col-span-2">
            No teams found. You can work with an "unassigned team" flow until your company creates
            teams.
          </article>
        ) : (
          teams.map((team) => {
            const teamMemberIds = membersByTeam[team.id] ?? [];
            const unassignedMembers = Object.values(memberInfoMap).filter(
              (m) => !teamMemberIds.includes(m.userId)
            );
            const isDroppingHere = dropTarget === team.id;
            const isDraggingFromHere = dragging?.fromTeamId === team.id;

            return (
              <article
                key={team.id}
                onDragOver={(e) => isCompanyAdmin && handleDragOver(e, team.id)}
                onDragLeave={isCompanyAdmin ? handleDragLeave : undefined}
                onDrop={(e) => isCompanyAdmin && handleDrop(e, team.id)}
                className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
                  isDroppingHere
                    ? "border-indigo-400 ring-2 ring-indigo-200"
                    : isDraggingFromHere
                      ? "border-slate-300 opacity-75"
                      : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {team.name}
                    </p>
                    {isDroppingHere && dragging && (
                      <p className="mt-0.5 text-xs text-indigo-600">
                        Drop to move {dragging.memberLabel} here
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Members
                  </p>
                  {teamMemberIds.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      {isDroppingHere ? "Drop here to assign" : "No active members."}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {teamMemberIds.map((userId) => {
                        const role = getMemberRole(userId);
                        const isLeader = role === "MANAGE_TEAM";
                        const isAdmin = role === "COMPANY_ADMIN";
                        const memberLabel = getMemberLabel(userId);
                        const isDraggingThis = dragging?.userId === userId;

                        return (
                          <li
                            key={`${team.id}-${userId}`}
                            draggable={isCompanyAdmin}
                            onDragStart={
                              isCompanyAdmin
                                ? () => handleDragStart(userId, team.id, memberLabel)
                                : undefined
                            }
                            onDragEnd={isCompanyAdmin ? handleDragEnd : undefined}
                            className={`flex items-center justify-between rounded-md px-2 py-1 text-sm ${
                              isCompanyAdmin ? "cursor-grab active:cursor-grabbing" : ""
                            } ${isDraggingThis ? "opacity-40" : ""}`}
                          >
                            <span
                              className={
                                isAdmin
                                  ? "font-semibold text-indigo-700"
                                  : isLeader
                                    ? "font-semibold text-slate-900"
                                    : "text-slate-800"
                              }
                            >
                              {memberLabel}
                              {isAdmin ? " (Admin)" : isLeader ? " (Leader)" : ""}
                            </span>
                            <DisableMemberButton
                              companyId={companyId}
                              userId={userId}
                              userName={memberLabel}
                              companyName={companyName}
                              isSelf={userId === currentUserId}
                              activeMembers={activeMembersList}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canManageTeams && (
                    <form action={assignTeamMemberAction} className="flex gap-2 pt-2">
                      <input type="hidden" name="companyId" value={companyId} />
                      <input type="hidden" name="teamId" value={team.id} />
                      <select
                        name="userId"
                        className="flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Add member
                        </option>
                        {unassignedMembers.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
                      >
                        Add
                      </button>
                    </form>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Unassigned members section */}
      {unassignedToAnyTeam.length > 0 && (
        <section
          aria-label="Unassigned team members"
          className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 shadow-sm"
          onDragOver={(e) => isCompanyAdmin && e.preventDefault()}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Team - No asignado
          </p>
          <p className="mt-1 text-xs text-amber-600">
            These members are not assigned to any team.
            {isCompanyAdmin && " Drag them to a team card above."}
          </p>
          <div className="mt-3 space-y-2">
            {unassignedToAnyTeam.map((member) => (
              <button
                type="button"
                key={member.userId}
                draggable={isCompanyAdmin}
                onDragStart={(e) => {
                  if (isCompanyAdmin) {
                    e.dataTransfer.setData("text/plain", member.userId);
                    e.dataTransfer.effectAllowed = "move";
                  }
                }}
                className="flex w-full cursor-grab items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-amber-100 text-left"
              >
                <span>{member.fullName}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
