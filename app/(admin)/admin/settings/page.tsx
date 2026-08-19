import { AdminShell } from "@/components/admin/AdminShell";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requireAdminPage } from "@/lib/admin-page";
import { getSiteSettings } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const settings = await getSiteSettings();

  return (
    <AdminShell title="Website Settings">
      <SettingsForm
        settings={{
          siteName: settings.siteName,
          headline: settings.headline,
          subtitle: settings.subtitle,
          announcement: settings.announcement,
          soundEnabled: settings.soundEnabled,
          confettiEnabled: settings.confettiEnabled,
          maintenanceMode: settings.maintenanceMode,
          recentResultCount: settings.recentResultCount,
          defaultFrom: settings.defaultFrom,
          defaultTo: settings.defaultTo,
          maximumAllowedRange: settings.maximumAllowedRange,
          publicDisclosureMessage: settings.publicDisclosureMessage,
          timezone: settings.timezone,
          contactEmail: settings.contactEmail
        }}
      />
    </AdminShell>
  );
}
