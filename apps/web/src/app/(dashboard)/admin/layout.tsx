import { SettingsNavButton } from "../dev-settings/settings-nav-button";
import { isCloud } from "~/utils/common";
import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-lg font-bold">Admin</h1>
      <div className="mt-4 flex gap-4">
        <SettingsNavButton href="/admin">
          SES Configurations
        </SettingsNavButton>
        {isCloud() ? (
          <SettingsNavButton href="/admin/teams">
            Teams
          </SettingsNavButton>
        ) : null}
        {isCloud() ? (
          <SettingsNavButton href="/admin/email-analytics">
            Email analytics
          </SettingsNavButton>
        ) : null}
        {isCloud() ? (
          <SettingsNavButton href="/admin/waitlist">
            Waitlist
          </SettingsNavButton>
        ) : null}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
