import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-row">
        <Link href="/" className="site-logo">
          TiMELiNES
        </Link>
        <p className="site-tagline">Everything has a timeline</p>
      </div>
      <div className="site-header-divider" />
    </header>
  );
}
