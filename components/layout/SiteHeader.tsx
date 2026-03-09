import Link from "next/link";
import { SearchBar } from "@/components/forms/SearchBar";

export function SiteHeader() {
  return (
    <header className="glass section-card" style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <div>
          <Link href="/" className="eyebrow">
            TiMELiNES
          </Link>
        </div>
        <nav style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/search">Search</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </div>
      <div style={{ marginTop: 18 }}>
        <SearchBar />
      </div>
    </header>
  );
}
