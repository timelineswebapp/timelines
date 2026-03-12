"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/src/lib/utils";
import { CloseIcon, SendIcon } from "@/components/ui/Icons";

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
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const hasValue = value.trim().length > 0;

  function handleClear() {
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <form action="/search" method="get" className={cn("search-form", className)}>
      {leadingLabel ? <span className="search-form-label">{leadingLabel}</span> : null}
      <label className="sr-only" htmlFor={inputId}>
        Search timelines
      </label>
      <div className={cn("search-input-shell", hasValue && "search-input-shell-has-clear")}>
        <input
          ref={inputRef}
          id={inputId}
          className="input search-input"
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
        />
        {hasValue ? (
          <button
            className="search-clear-button"
            type="button"
            aria-label="Clear search"
            onClick={handleClear}
          >
            <CloseIcon />
          </button>
        ) : null}
        <button className="search-send-button" type="submit" aria-label="Search timelines">
          <SendIcon />
        </button>
      </div>
    </form>
  );
}
