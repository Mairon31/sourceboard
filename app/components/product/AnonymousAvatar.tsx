export function AnonymousAvatar({ size }: { size: "sm" | "md" | "lg" }) {
  return (
    <span className={`sb-avatar sb-avatar--${size}`} aria-hidden="true">
      <svg
        viewBox="0 0 32 32"
        width="68%"
        height="68%"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9.5 13.2c0-4.1 2.7-7.2 6.5-7.2s6.5 3.1 6.5 7.2c0 3.6-2.6 6.5-6.5 6.5s-6.5-2.9-6.5-6.5Z" />
        <path d="M5.8 27c1.3-4.3 5-6.6 10.2-6.6S24.9 22.7 26.2 27" />
        <path d="M8.2 10.5 5.5 14l3.1 1.5M23.8 10.5l2.7 3.5-3.1 1.5" opacity="0.72" />
      </svg>
    </span>
  );
}
