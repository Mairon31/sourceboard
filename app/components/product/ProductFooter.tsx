import { Link } from "react-router";

export function ProductFooter() {
  return (
    <footer className="product-footer">
      <div className="product-footer__inner">
        <div>
          <strong>SourceBoard</strong>
          <span>Trace images back to their original source.</span>
        </div>
        <nav aria-label="Product information">
          <Link to="/docs">Docs</Link>
          <Link to="/legal">Privacy and terms</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </div>
    </footer>
  );
}
