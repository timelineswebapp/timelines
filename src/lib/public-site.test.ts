import assert from "node:assert/strict";
import test from "node:test";
import {
  PublicSiteConfigurationError,
  buildPublicUrl,
  resolvePublicSiteConfiguration
} from "@/src/lib/public-site";

test("production canonical identity remains pinned to the established production origin", () => {
  const configuration = resolvePublicSiteConfiguration({
    TIMELINES_ENVIRONMENT: "production",
    NEXT_PUBLIC_SITE_URL: "https://www.timelines.sbs"
  });

  assert.deepEqual(configuration, { environment: "production", origin: "https://www.timelines.sbs" });
  assert.equal(buildPublicUrl("/timelines/example", configuration), "https://www.timelines.sbs/timelines/example");
});

test("staging canonical, Open Graph, and internal public URLs remain on the isolated staging origin", () => {
  const configuration = resolvePublicSiteConfiguration({
    TIMELINES_ENVIRONMENT: "staging",
    NEXT_PUBLIC_SITE_URL: "https://timelines-staging.vercel.app"
  });

  assert.deepEqual(configuration, { environment: "staging", origin: "https://timelines-staging.vercel.app" });
  assert.equal(buildPublicUrl("/timelines/example", configuration), "https://timelines-staging.vercel.app/timelines/example");
  assert.equal(buildPublicUrl("/api/og/timeline/example", configuration), "https://timelines-staging.vercel.app/api/og/timeline/example");
  assert.throws(() => buildPublicUrl("//www.timelines.sbs/unsafe", configuration), PublicSiteConfigurationError);
});

test("staging with missing canonical configuration fails closed instead of using production", () => {
  assert.throws(
    () => resolvePublicSiteConfiguration({ TIMELINES_ENVIRONMENT: "staging" }),
    /staging must never fall back to the production origin/u
  );
});

test("invalid canonical environment and origin configuration fails closed", () => {
  assert.throws(
    () => resolvePublicSiteConfiguration({ TIMELINES_ENVIRONMENT: "staging", NEXT_PUBLIC_SITE_URL: "https://www.timelines.sbs" }),
    PublicSiteConfigurationError
  );
  assert.throws(
    () => resolvePublicSiteConfiguration({ TIMELINES_ENVIRONMENT: "staging", NEXT_PUBLIC_SITE_URL: "http://timelines-staging.vercel.app" }),
    PublicSiteConfigurationError
  );
  assert.throws(
    () => resolvePublicSiteConfiguration({ TIMELINES_ENVIRONMENT: "preview", NEXT_PUBLIC_SITE_URL: "https://timelines-staging.vercel.app" }),
    PublicSiteConfigurationError
  );
});
