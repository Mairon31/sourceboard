import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";
import { joinClassNames } from "../../../shared/design/component-variants";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  className?: string;
}

export function Tabs({ items, defaultValue, className }: TabsProps) {
  const firstValue = defaultValue ?? items[0]?.value;
  if (!firstValue) return null;

  return (
    <BaseTabs.Root
      className={joinClassNames("sb-tabs", className)}
      defaultValue={firstValue}
    >
      <BaseTabs.List className="sb-tabs__list">
        {items.map((item) => (
          <BaseTabs.Tab key={item.value} value={item.value} className="sb-tabs__tab focus-ring">
            {item.label}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator className="sb-tabs__indicator" />
      </BaseTabs.List>
      <div className="sb-tabs__panels">
        {items.map((item) => (
          <BaseTabs.Panel key={item.value} value={item.value} className="sb-tabs__panel">
            {item.content}
          </BaseTabs.Panel>
        ))}
      </div>
    </BaseTabs.Root>
  );
}
