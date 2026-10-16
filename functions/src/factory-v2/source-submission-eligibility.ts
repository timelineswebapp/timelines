/** Pure authority gate used before any candidate can enter V2 retrieval. */
export function sourceSubmissionUrlMatchesAuthority(input: { submittedUrl: string; boundPublisherVersionIds: readonly string[]; publisherVersionId: string; knownDomains: readonly string[] }): boolean {
  let hostname: string;
  try {
    const url = new URL(input.submittedUrl);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    hostname = url.hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  } catch { return false; }
  if (!input.boundPublisherVersionIds.includes(input.publisherVersionId)) return false;
  return input.knownDomains.some((domain) => {
    const normalized = domain.toLocaleLowerCase("en-US").replace(/^www\./u, "");
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}
