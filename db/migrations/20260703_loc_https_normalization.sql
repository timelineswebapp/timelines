UPDATE source_authority_records
SET canonical_url = regexp_replace(canonical_url, '^http://(www\.)?loc\.gov', 'https://\1loc.gov'),
    origin = jsonb_set(
      origin,
      '{providerUrl}',
      to_jsonb(regexp_replace(origin->>'providerUrl', '^http://(www\.)?loc\.gov', 'https://\1loc.gov')),
      true
    )
WHERE provider = 'library_of_congress'
  AND canonical_url ~ '^http://(www\.)?loc\.gov';
