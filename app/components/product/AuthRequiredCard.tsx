import { Link } from "react-router";
import { Card } from "../ui";

export function AuthRequiredCard({
  title = "Your account is needed here",
  description = "Sign in or create a free account to access this private SourceBoard area.",
  unavailable = false,
}: {
  title?: string;
  description?: string;
  unavailable?: boolean;
}) {
  return (
    <Card
      className="product-auth-required"
      role={unavailable ? "status" : "region"}
      aria-label="Account access"
    >
      <div className="product-auth-required__icon" aria-hidden="true">
        <span />
      </div>
      <div className="product-auth-required__copy">
        <span className="product-eyebrow">Account access</span>
        <h2>{unavailable ? "Service temporarily unavailable" : title}</h2>
        <p>{unavailable ? "Please try again shortly." : description}</p>
      </div>
      {!unavailable ? (
        <div className="product-auth-required__actions">
          <Link className="sb-button sb-button--primary sb-button--md" to="/login">
            Sign in
          </Link>
          <Link className="sb-button sb-button--secondary sb-button--md" to="/register">
            Create account
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
