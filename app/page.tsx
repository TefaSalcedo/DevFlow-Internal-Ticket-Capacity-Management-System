import { redirect } from "next/navigation";

import { getSessionOrNull } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getSessionOrNull();
  redirect(user ? "/dashboard" : "/login");
}
