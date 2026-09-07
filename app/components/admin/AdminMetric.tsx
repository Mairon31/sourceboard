import { Link } from "react-router";
import { Card } from "../ui";

export function AdminMetric({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const content = (
    <Card className="admin-metric admin-surface">
      <span className="admin-metric__label">{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </Card>
  );

  return href ? (
    <Link className="admin-metric-link" to={href}>
      {content}
    </Link>
  ) : (
    content
  );
}
