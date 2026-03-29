import Image from "next/image";
import Link from "next/link";
import { TIMELINES_LOGO_PUBLIC_PATH } from "@/src/lib/brand";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-row">
        <Link href="/" className="site-logo" aria-label="TiMELiNES home">
          <Image
            src={TIMELINES_LOGO_PUBLIC_PATH}
            alt=""
            aria-hidden="true"
            width={673}
            height={94}
            priority
            className="site-logo-image"
          />
          <span className="sr-only">TiMELiNES</span>
        </Link>
        <p className="site-tagline">Everything has a timeline</p>
      </div>
      <div className="site-header-divider" />
    </header>
  );
}
