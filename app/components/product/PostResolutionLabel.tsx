import type { PostSummary } from "../../../shared/ui/contracts";
import { useI18n } from "../../i18n/I18nProvider";
import { CheckIcon, InfoIcon, ShieldCheckIcon } from "../ui";

type ResolutionPost = Pick<PostSummary, "acceptedSource" | "verifiedSource">;

export function PostResolutionLabel({
  post,
  showOpen = false,
}: {
  post: ResolutionPost;
  showOpen?: boolean;
}) {
  const { t } = useI18n();
  const state = post.verifiedSource
    ? "verified"
    : post.acceptedSource
      ? "accepted"
      : showOpen
        ? "open"
        : null;

  if (!state) return null;

  const Icon = state === "verified" ? ShieldCheckIcon : state === "accepted" ? CheckIcon : InfoIcon;
  const label =
    state === "verified"
      ? t("post.meta.verified")
      : state === "accepted"
        ? t("post.meta.acceptedSource")
        : t("post.status.open");

  return (
    <span className={`product-resolution-label product-resolution-label--${state}`}>
      <Icon width="15" height="15" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
