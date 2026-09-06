import { Link } from "react-router";
import { BellIcon, SearchIcon } from "../ui";
import { ThemeControl } from "./ThemeControl";

export function TopBar() {
  return (
    <header className="sb-topbar glass-panel glass-panel--strong">
      <Link className="sb-brand focus-ring" to="/" aria-label="SourceBoard">
        <span className="sb-brand__mark" aria-hidden="true">S</span>
        <span className="sb-brand__name">SourceBoard</span>
      </Link>

      <label className="sb-topbar-search">
        <span className="sr-only">Search SourceBoard</span>
        <SearchIcon width="18" height="18" />
        <input type="search" readOnly value="" placeholder="Search SourceBoard" aria-label="Search SourceBoard" />
      </label>

      <div className="sb-topbar-actions">
        <ThemeControl />
        <Link to="/notifications" aria-label="Notifications" className="sb-topbar-notification-link focus-ring">
          <BellIcon width="18" height="18" />
        </Link>
      </div>
    </header>
  );
}
