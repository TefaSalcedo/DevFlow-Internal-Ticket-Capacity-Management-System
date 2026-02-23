import { redirect } from "next/navigation";

interface TicketsAllPageProps {
  searchParams: Promise<{
    doneMonth?: string;
    team?: string;
  }>;
}

function normalizeDoneMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function TicketsAllPage({ searchParams }: TicketsAllPageProps) {
  const params = await searchParams;
  const doneMonth = normalizeDoneMonth(params.doneMonth);
  const nextParams = new URLSearchParams();
  nextParams.set("doneMonth", doneMonth);

  if (params.team) {
    nextParams.set("team", params.team);
  }

  redirect(`/tickets?${nextParams.toString()}`);
}
