import { getUser } from "@/lib/auth";
import { Sidebar, MobileHeader } from "@/components/sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar userEmail={user.email ?? ""} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader userEmail={user.email ?? ""} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
