export function AchievementIcon({ icon }: { icon: string }) {
  const mediaMatch = /^media:([A-Za-z0-9_-]{8,128})$/.exec(icon);
  if (!mediaMatch) return <span aria-hidden="true">{icon}</span>;
  return (
    <img
      className="product-achievement-icon"
      src={`/api/media/achievement-icons/${encodeURIComponent(mediaMatch[1])}`}
      alt=""
      loading="lazy"
    />
  );
}
