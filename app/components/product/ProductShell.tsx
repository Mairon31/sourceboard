import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";
import { AppShell } from "../layout/AppShell";
import { MobileProductNav, ProductContextRail, ProductNav } from "./ProductNav";
import { markNavigationReady } from "../../data/performance-metrics";
import { ProductFooter } from "./ProductFooter";
import type { ProfileThemePreset } from "../../../shared/store/cosmetics";
import "./profile-page.css";

export interface ProductShellProps {
  children: ReactNode;
  rightRail?: ReactNode;
  wide?: boolean;
  profileTheme?: ProfileThemePreset;
}

export function ProductShell({
  children,
  rightRail,
  wide = false,
  profileTheme,
}: ProductShellProps) {
  const location = useLocation();

  useEffect(() => {
    markNavigationReady(location.pathname);
  }, [location.pathname]);

  return (
    <>
      <AppShell
        leftRail={<ProductNav />}
        rightRail={rightRail === null ? undefined : (rightRail ?? <ProductContextRail />)}
      >
        <div
          className={`product-page${wide ? " product-page--wide" : ""}${
            profileTheme ? " product-page--profile" : ""
          }`}
          data-profile-theme={profileTheme}
        >
          {children}
        </div>
      </AppShell>
      <MobileProductNav />
      <ProductFooter />
    </>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="product-page-header">
      <div className="product-page-header__copy">
        {eyebrow ? <span className="product-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="product-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function PresentationNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="product-presentation-notice" role="note">
      <strong>Presentation only</strong>
      <span>
        {children ?? "This interaction is not persisted until the relevant backend phase."}
      </span>
    </div>
  );
}
