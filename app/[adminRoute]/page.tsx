import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { getAdminRouteSlug } from "@/src/lib/admin-route";
import { config } from "@/src/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminPage({ params }: { params: Promise<{ adminRoute: string }> }) {
  const { adminRoute } = await params;
  const adminRouteSlug = getAdminRouteSlug();

  if (!adminRouteSlug || adminRoute !== adminRouteSlug) {
    notFound();
  }

  return (
    <div className="content-grid">
      <GlassPanel>
        <span className="eyebrow">Founder Home</span>
        <h1 className="page-title" style={{ fontFamily: "var(--font-serif)" }}>
          What requires your attention today?
        </h1>
        <p className="section-copy">
          Monitor production, review exceptions, and confirm what TiMELiNES has published.
        </p>
      </GlassPanel>
      <AdminDashboard initialDatabaseConnected={Boolean(config.databaseUrl)} />
    </div>
  );
}
