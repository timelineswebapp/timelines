export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" method="get" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
      <label className="sr-only" htmlFor="timeline-search">
        Search timelines
      </label>
      <input
        id="timeline-search"
        className="input"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search timelines, events, and tags"
      />
      <button className="button" type="submit">
        Search
      </button>
    </form>
  );
}
