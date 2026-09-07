import { Dropdown } from "../ui";

export interface AdminActionItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export function AdminActionMenu({ label, items }: { label: string; items: AdminActionItem[] }) {
  return <Dropdown label={label} items={items} align="end" className="admin-action-menu" />;
}
