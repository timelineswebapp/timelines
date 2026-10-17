const PRODUCTION_PUBLIC_SITE_URL = "https://www.timelines.sbs";
const STAGING_PUBLIC_SITE_URL = "https://timelines-staging.vercel.app";

export type PublicSiteEnvironment = "production" | "staging";

export type PublicSiteConfiguration = {
  environment: PublicSiteEnvironment;
  origin: string;
};

export type PublicSiteEnvironmentVariables = {
  [key: string]: string | undefined;
  TIMELINES_ENVIRONMENT?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export class PublicSiteConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicSiteConfigurationError";
  }
}

function canonicalHttpsOrigin(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new PublicSiteConfigurationError(`${label} must be an absolute HTTPS origin.`);
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new PublicSiteConfigurationError(`${label} must be an absolute HTTPS origin without credentials, path, query, or fragment.`);
  }

  return parsed.origin;
}

function environmentValue(variables: PublicSiteEnvironmentVariables): string {
  return variables.TIMELINES_ENVIRONMENT?.trim() || "production";
}

/**
 * Resolves canonical identity exclusively from deployment configuration. Request
 * headers, including Host and forwarded-host headers, are deliberately ignored.
 */
export function resolvePublicSiteConfiguration(
  variables: PublicSiteEnvironmentVariables = process.env
): PublicSiteConfiguration {
  const environment = environmentValue(variables);
  const configuredUrl = variables.NEXT_PUBLIC_SITE_URL?.trim();

  if (environment === "production") {
    if (configuredUrl && canonicalHttpsOrigin(configuredUrl, "NEXT_PUBLIC_SITE_URL") !== PRODUCTION_PUBLIC_SITE_URL) {
      throw new PublicSiteConfigurationError("Production NEXT_PUBLIC_SITE_URL must equal the established production canonical origin.");
    }
    return { environment, origin: PRODUCTION_PUBLIC_SITE_URL };
  }

  if (environment === "staging") {
    if (!configuredUrl) {
      throw new PublicSiteConfigurationError("Staging requires NEXT_PUBLIC_SITE_URL; staging must never fall back to the production origin.");
    }
    if (canonicalHttpsOrigin(configuredUrl, "NEXT_PUBLIC_SITE_URL") !== STAGING_PUBLIC_SITE_URL) {
      throw new PublicSiteConfigurationError("Staging NEXT_PUBLIC_SITE_URL must equal the approved isolated staging origin.");
    }
    return { environment, origin: STAGING_PUBLIC_SITE_URL };
  }

  throw new PublicSiteConfigurationError("TIMELINES_ENVIRONMENT must be production or staging.");
}

export function getVerifiedPublicSiteUrl(): string {
  return resolvePublicSiteConfiguration().origin;
}

function assertInternalPath(path: string): void {
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    throw new PublicSiteConfigurationError("Public URLs must use an absolute internal path.");
  }
}

export function buildPublicUrl(path: string, configuration = resolvePublicSiteConfiguration()): string {
  assertInternalPath(path);
  const resolved = new URL(path, configuration.origin);
  if (resolved.origin !== configuration.origin) {
    throw new PublicSiteConfigurationError("Public URL resolution escaped the configured canonical origin.");
  }
  return resolved.toString();
}

/**
 * Retained for existing configuration callers. The value is resolved using the
 * same explicit environment policy as every canonical and Open Graph URL.
 */
export function normalizePublicSiteUrl(rawValue?: string): string {
  return resolvePublicSiteConfiguration({
    TIMELINES_ENVIRONMENT: process.env.TIMELINES_ENVIRONMENT,
    NEXT_PUBLIC_SITE_URL: rawValue
  }).origin;
}
