import { AppShell } from "@/app/(protected)/components/app-shell";
import { getAuthContext } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await getAuthContext();

  return <AppShell auth={auth}>{children}</AppShell>;
}
