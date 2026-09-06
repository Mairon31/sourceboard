import { BellIcon, IconButton, SearchIcon } from "../ui";
import { ThemeControl } from "./ThemeControl";

export function TopBar() {
  return (
    <header className="sb-topbar glass-panel glass-panel--strong">
      <a className="sb-brand focus-ring" href="/" aria-label="SourceBoard home">
        <span className="sb-brand__mark" aria-hidden="true">
          S
        </span>
        <span className="sb-brand__name">SourceBoard</span>
      </a>

      <label className="sb-topbar-search">
        <span className="sr-only">Search preview</span>
        <SearchIcon width="18" height="18" />
        <input
          type="search"
          readOnly
          value=""
          placeholder="Search preview"
          aria-label="Search preview"
        />
      </label>

      <div className="sb-topbar-actions">
        <ThemeControl />
        <IconButton label="Notifications preview" disabled>
          <BellIcon />
        </IconButton>
      </div>
    </header>
  );
}
