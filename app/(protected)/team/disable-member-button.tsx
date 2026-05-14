"use client";

import { UserX } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import {
  type DisableMembershipResult,
  disableCompanyMembershipAction,
  transferAdminAndLeaveAction,
  transferTeamLeadAndLeaveAction,
} from "./actions";

interface DisableMemberButtonProps {
  companyId: string;
  userId: string;
  userName: string;
  companyName: string;
  isSelf: boolean;
  activeMembers: Array<{ userId: string; fullName: string }>;
  userRole?: "COMPANY_ADMIN" | "MANAGE_TEAM" | "MEMBER";
}

export function DisableMemberButton({
  companyId,
  userId,
  userName,
  companyName,
  isSelf,
  activeMembers,
  userRole,
}: DisableMemberButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const [disableState, disableAction, disablePending] = useActionState<
    DisableMembershipResult,
    FormData
  >(disableCompanyMembershipAction, {});

  const [transferState, transferAction, transferPending] = useActionState<
    DisableMembershipResult,
    FormData
  >(userRole === "MANAGE_TEAM" ? transferTeamLeadAndLeaveAction : transferAdminAndLeaveAction, {});

  function handleClick() {
    if (isSelf) {
      setShowTransferModal(true);
    } else {
      setShowModal(true);
    }
  }

  // Close modal automatically on success
  useEffect(() => {
    if (disableState.success) {
      setShowModal(false);
    }
  }, [disableState.success]);

  useEffect(() => {
    if (transferState.success) {
      setShowTransferModal(false);
    }
  }, [transferState.success]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="group flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
        title="Ya no trabaja aquí"
      >
        <UserX className="h-3.5 w-3.5" />
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Desvincular usuario</h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{userName}</span> ya no estará vinculado
              a la empresa <span className="font-medium">{companyName}</span>. No verá los tickets
              ni equipos de esta empresa.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Su historial en tickets y reuniones se conservará pero aparecerá como desactivado.
            </p>

            {disableState.error && !disableState.requiresTransfer && (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {disableState.error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Cancelar
              </button>
              <form action={disableAction}>
                <input type="hidden" name="companyId" value={companyId} />
                <input type="hidden" name="userId" value={userId} />
                <button
                  type="submit"
                  disabled={disablePending}
                  className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                >
                  {disablePending ? "Desvinculando..." : "Desvincular"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Transferir rol y desvincularte</h3>
            <p className="mt-2 text-sm text-slate-600">
              Para desvincularte de <span className="font-medium">{companyName}</span>, primero
              selecciona a quién deseas pasarle el rol de{" "}
              <span className="font-medium">
                {userRole === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "MANAGE_TEAM"}
              </span>
              .
            </p>

            {transferState.error && (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {transferState.error}
              </p>
            )}

            <form action={transferAction} className="mt-4 space-y-4">
              <input type="hidden" name="companyId" value={companyId} />
              <div>
                <label
                  htmlFor="newAdminUserId"
                  className="block text-sm font-medium text-slate-700"
                >
                  Nuevo {userRole === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "MANAGE_TEAM"}
                </label>
                <select
                  id="newAdminUserId"
                  name="newAdminUserId"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecciona un usuario...
                  </option>
                  {activeMembers
                    .filter((m) => m.userId !== userId)
                    .map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferPending}
                  className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                >
                  {transferPending ? "Transfiriendo..." : "Transferir y desvincularme"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
