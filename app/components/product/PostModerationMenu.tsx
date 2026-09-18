import { useState } from "react";
import { useRevalidator } from "react-router";
import type { PostSummary } from "../../../shared/ui/contracts";
import { canOpenPostModeration } from "../../data/post-actions";
import { useI18n } from "../../i18n/I18nProvider";
import { MoreIcon, Dropdown } from "../ui";
import { ModerationActionDialog } from "./ModerationActionDialog";

export function PostModerationMenu({
  post,
  className,
  onChanged,
}: {
  post: PostSummary;
  className?: string;
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);

  if (!canOpenPostModeration(post.permissions)) return null;

  return (
    <>
      <Dropdown
        label={t("post.menu.moderate")}
        ariaLabel={t("post.menu.moderate")}
        triggerIcon={<MoreIcon width="18" height="18" />}
        iconOnly
        className={className}
        items={[{ label: t("post.menu.moderate"), onSelect: () => setOpen(true) }]}
      />
      <ModerationActionDialog
        open={open}
        target={{ targetType: "POST", post }}
        onOpenChange={setOpen}
        onApplied={() => {
          onChanged?.();
          revalidator.revalidate();
        }}
      />
    </>
  );
}
