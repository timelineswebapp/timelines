import { cn } from "@/src/lib/utils";

export function SearchBar({
  defaultValue = "",
  placeholder = "Search timelines",
  buttonLabel = "Search",
  leadingLabel,
  className,
  inputId = "timeline-search"
}: {
  defaultValue?: string;
  placeholder?: string;
  buttonLabel?: string;
  leadingLabel?: string;
  className?: string;
  inputId?: string;
}) {
  return (
    <form action="/search" method="get" className={cn("search-form", className)}>
      {leadingLabel ? <span className="search-form-label">{leadingLabel}</span> : null}
      <label className="sr-only" htmlFor={inputId}>
        Search timelines
      </label>
      <input
        id={inputId}
        className="input"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
      <button className="button" type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}
