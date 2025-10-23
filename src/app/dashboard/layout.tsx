import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardShell from "../../components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const hasAuth = cookieStore.get("wms_auth")?.value === "1";
  if (!hasAuth) redirect("/");
  return <DashboardShell>{children}</DashboardShell>;
}
