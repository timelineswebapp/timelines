import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { GlassPanel } from "@/components/ui/GlassPanel";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="content-grid">
      <GlassPanel>
        <span className="eyebrow">Admin dashboard</span>
        <h1 className="page-title" style={{ fontFamily: "var(--font-serif)" }}>Editorial operations</h1>
        <p className="section-copy">
          Timeline, event, source, tag, request, analytics, and import controls are isolated behind authenticated API routes.
        </p>
      </GlassPanel>
      <AdminDashboard />
    </div>
  );
}
