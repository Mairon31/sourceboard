import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

export interface AppShellProps {
  children: ReactNode;
  leftRail?: ReactNode;
  rightRail?: ReactNode;
}

export function AppShell({ children, leftRail, rightRail }: AppShellProps) {
  return (
    <div className="sb-app-shell">
      <TopBar />
      <div className="sb-app-shell__body">
        <aside className="sb-app-shell__rail sb-app-shell__rail--left">{leftRail}</aside>
        <main className="sb-app-shell__main">{children}</main>
        <aside className="sb-app-shell__rail sb-app-shell__rail--right">{rightRail}</aside>
      </div>
    </div>
  );
}
