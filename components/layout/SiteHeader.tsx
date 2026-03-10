import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-row">
        <Link href="/" className="site-logo">
          <span className="site-logo-mark" aria-hidden="true">
            <span className="site-logo-strong">T</span>
            <span className="site-logo-lower">i</span>
            <span className="site-logo-strong">MEL</span>
            <span className="site-logo-lower">i</span>
            <span className="site-logo-strong">NES</span>
          </span>
          <span className="sr-only">TiMELiNES</span>
        </Link>
        <p className="site-tagline">Everything has a timeline</p>
      </div>
      <div className="site-header-divider" />
    </header>
  );
}
