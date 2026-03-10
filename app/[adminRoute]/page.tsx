import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { getAdminRouteSlug } from "@/src/lib/admin-route";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function AdminPage({ params }: { params: { adminRoute: string } }) {
  const adminRouteSlug = getAdminRouteSlug();

  if (!adminRouteSlug || params.adminRoute !== adminRouteSlug) {
    notFound();
  }

  return (
    <div className="content-grid">
      <GlassPanel>
        <span className="eyebrow">Admin dashboard</span>
        <h1 className="page-title" style={{ fontFamily: "var(--font-serif)" }}>
          Editorial operations
        </h1>
        <p className="section-copy">
          Timeline, event, source, tag, request, analytics, and import controls are isolated behind authenticated API routes.
        </p>
      </GlassPanel>
      <AdminDashboard />
    </div>
  );
}
