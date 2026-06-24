type IconProps = {
  className?: string;
};

export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M4.5 6.2H15.5M4.5 10H15.5M4.5 13.8H15.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M4 10.2 15.7 4.8 11.4 15.5 9.2 10.9 4 10.2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M9.1 10.7 15.7 4.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M5.5 5.5 14.5 14.5M14.5 5.5 5.5 14.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M11.8 4.9 6.6 10l5.2 5.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M7 10h7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M11.6 4.4H15.6V8.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M8 12 15.4 4.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
      <path
        d="M14.3 10.6V13.4A1.8 1.8 0 0 1 12.5 15.2H6.6A1.8 1.8 0 0 1 4.8 13.4V7.5A1.8 1.8 0 0 1 6.6 5.7H9.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function SocialXIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M5.2 4.8 14.8 15.2M14.7 4.8 5.3 15.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function SocialInstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <rect
        x="4.6"
        y="4.6"
        width="10.8"
        height="10.8"
        rx="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="10" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13.1" cy="6.9" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function SocialFacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M11.2 16v-5.4H13l.3-2.1h-2.1V7.2c0-.6.2-1 1-1h1.2V4.4c-.2 0-.9-.1-1.7-.1-1.8 0-3 1.1-3 3.1v1.1h-2v2.1h2V16h2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SocialTikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M11.4 4.2c.3 2 1.4 3.1 3.2 3.2v2c-1.2 0-2.3-.4-3.2-1v3.7c0 2.3-1.5 3.8-3.7 3.8-1.9 0-3.3-1.3-3.3-3.1 0-2 1.6-3.3 3.8-3.1v2c-1-.1-1.6.4-1.6 1.1 0 .6.5 1.1 1.2 1.1.8 0 1.4-.5 1.4-1.7v-8h2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="m5.8 8 4.2 4.2L14.2 8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
