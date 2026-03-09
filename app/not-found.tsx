import Link from "next/link";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default function NotFoundPage() {
  return (
    <GlassPanel>
      <span className="eyebrow">404</span>
      <h1 className="page-title" style={{ fontFamily: "var(--font-serif)" }}>Timeline not found</h1>
      <p className="section-copy">The requested resource is not in the current catalog.</p>
      <Link href="/" className="pill">
        Return home
      </Link>
    </GlassPanel>
  );
}
