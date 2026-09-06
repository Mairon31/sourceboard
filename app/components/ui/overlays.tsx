import { Dialog } from "@base-ui/react/dialog";
import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import { Menu } from "@base-ui/react/menu";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";
import { joinClassNames } from "../../../shared/design/component-variants";
import { Button, IconButton } from "./controls";
import { ChevronDownIcon, CloseIcon } from "./icons";

export interface ModalProps {
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Modal({ triggerLabel, title, description, children }: ModalProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="sb-button sb-button--secondary sb-button--md motion-interactive">
        {triggerLabel}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="sb-overlay-backdrop" />
        <Dialog.Viewport className="sb-overlay-viewport">
          <Dialog.Popup className="sb-modal glass-panel glass-panel--strong">
            <header className="sb-overlay-header">
              <div>
                <Dialog.Title className="sb-overlay-title">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="sb-overlay-description">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
              <Dialog.Close
                className="sb-button sb-button--ghost sb-button--sm sb-icon-button motion-interactive"
                aria-label="Close dialog"
              >
                <CloseIcon />
              </Dialog.Close>
            </header>
            <div className="sb-overlay-content">{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface DrawerProps {
  triggerLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Drawer({ triggerLabel, title, description, children }: DrawerProps) {
  return (
    <BaseDrawer.Root swipeDirection="down">
      <BaseDrawer.Trigger className="sb-button sb-button--secondary sb-button--md motion-interactive">
        {triggerLabel}
      </BaseDrawer.Trigger>
      <BaseDrawer.Portal>
        <BaseDrawer.Backdrop className="sb-overlay-backdrop" />
        <BaseDrawer.Viewport className="sb-drawer-viewport">
          <BaseDrawer.Popup className="sb-drawer glass-panel glass-panel--strong">
            <div className="sb-drawer-handle" aria-hidden="true" />
            <BaseDrawer.Content>
              <header className="sb-overlay-header">
                <div>
                  <BaseDrawer.Title className="sb-overlay-title">{title}</BaseDrawer.Title>
                  {description ? (
                    <BaseDrawer.Description className="sb-overlay-description">
                      {description}
                    </BaseDrawer.Description>
                  ) : null}
                </div>
                <BaseDrawer.Close
                  className="sb-button sb-button--ghost sb-button--sm sb-icon-button motion-interactive"
                  aria-label="Close drawer"
                >
                  <CloseIcon />
                </BaseDrawer.Close>
              </header>
              <div className="sb-overlay-content">{children}</div>
            </BaseDrawer.Content>
          </BaseDrawer.Popup>
        </BaseDrawer.Viewport>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}

export interface DropdownItem {
  label: string;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface DropdownProps {
  label: string;
  items: DropdownItem[];
  align?: "start" | "center" | "end";
  className?: string;
}

export function Dropdown({ label, items, align = "end", className }: DropdownProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={joinClassNames(
          "sb-button",
          "sb-button--ghost",
          "sb-button--md",
          "motion-interactive",
          className,
        )}
      >
        <span>{label}</span>
        <ChevronDownIcon width="16" height="16" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="sb-menu-positioner" sideOffset={8} align={align}>
          <Menu.Popup className="sb-menu glass-panel glass-panel--strong">
            {items.map((item) => (
              <Menu.Item
                key={item.label}
                className="sb-menu__item"
                disabled={item.disabled}
                onClick={item.onSelect}
              >
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export interface TooltipProps {
  label: string;
  content: ReactNode;
  children?: ReactNode;
}

export function Tooltip({ label, content, children }: TooltipProps) {
  return (
    <BaseTooltip.Provider delay={350} closeDelay={80}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger className="sb-tooltip-trigger focus-ring" aria-label={label}>
          {children ?? label}
        </BaseTooltip.Trigger>
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner sideOffset={10}>
            <BaseTooltip.Popup className="sb-tooltip glass-panel glass-panel--strong">
              <BaseTooltip.Arrow className="sb-tooltip__arrow" />
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}

export function OverlayActionRow({ children }: { children: ReactNode }) {
  return <div className="sb-overlay-actions">{children}</div>;
}

export { Button, IconButton };
