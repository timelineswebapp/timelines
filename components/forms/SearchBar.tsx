import { cn } from "@/src/lib/utils";
import { SendIcon } from "@/components/ui/Icons";

export function SearchBar({
  defaultValue = "",
  placeholder = "Search timelines",
  leadingLabel,
  className,
  inputId = "timeline-search"
}: {
  defaultValue?: string;
  placeholder?: string;
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
      <div className="search-input-shell">
        <input
          id={inputId}
          className="input search-input"
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
        <button className="search-send-button" type="submit" aria-label="Search timelines">
          <SendIcon />
        </button>
      </div>
    </form>
  );
}
