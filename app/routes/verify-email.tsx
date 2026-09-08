import { useNavigate, useSearchParams } from "react-router";
import { AuthScreen } from "../components/product/AuthScreen";
import { Button, GlassPanel } from "../components/ui";

export default function VerifyEmailRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const firebaseVerified = searchParams.get("firebase") === "verified";

  if (!firebaseVerified) return <AuthScreen mode="verify" />;

  return (
    <main className="product-auth-shell">
      <GlassPanel className="product-auth-card">
        <header>
          <span className="product-eyebrow">Email verification</span>
          <h1>Email verified</h1>
          <p>
            Firebase confirmed your email. Sign in once to synchronize that verified state with
            SourceBoard and create your SourceBoard session.
          </p>
        </header>
        <div className="product-form-grid" role="status" aria-live="polite">
          <p className="product-auth-security-note">
            You do not need another SourceBoard verification token. Your next successful sign-in
            reads the verified Firebase account and activates the matching SourceBoard account.
          </p>
          <Button type="button" onClick={() => navigate("/login?verified=1")}>
            Continue to sign in
          </Button>
        </div>
      </GlassPanel>
    </main>
  );
}
