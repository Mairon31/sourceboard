import { useEffect, useMemo, useState } from "react";
import {
  AVATAR_FRAME_PRESETS,
  NAME_EFFECT_PRESETS,
  NAME_FONT_FAMILIES,
  PROFILE_EFFECT_PRESETS,
  PROFILE_THEME_PRESETS,
} from "../../../shared/store/cosmetics";
import { sanitizeCommunityCosmeticCss } from "../../../shared/store/community-css";
import {
  COSMETIC_VISUAL_NAMESPACE,
  type CosmeticVisualDefinition,
} from "../../../shared/store/custom-cosmetics";
import { readCsrfToken } from "../../data/csrf";
import { Button, Card, Input, Textarea } from "../ui";
import { useI18n } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n";
import { cosmeticVisualStyle } from "./cosmetic-visual";
import { ProfileCosmeticPreview } from "./ProfileCosmeticPreview";
import "./community-cosmetics.css";

type CosmeticType =
  "AVATAR_FRAME" | "PROFILE_BANNER" | "PROFILE_EFFECT" | "NAME_EFFECT" | "NAME_FONT";
type ProfilePreviewType = "AVATAR_FRAME" | "PROFILE_BANNER" | "PROFILE_EFFECT";
type CommunityState = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
type Submission = {
  id: string;
  type: CosmeticType;
  name: string;
  description: string;
  pricePoints: number;
  configJson: string;
  communityState: CommunityState;
  moderationState: "CLEAR" | "HIDDEN" | "REMOVED";
  reviewNote: string | null;
  createdAt: number;
};

const COSMETIC_TYPES: readonly CosmeticType[] = [
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_EFFECT",
  "NAME_FONT",
];

function typeLabel(type: CosmeticType): MessageKey {
  if (type === "AVATAR_FRAME") return "community.type.avatarFrame";
  if (type === "PROFILE_BANNER") return "community.type.profileBanner";
  if (type === "PROFILE_EFFECT") return "community.type.profileEffect";
  if (type === "NAME_EFFECT") return "community.type.nameEffect";
  return "community.type.nameFont";
}

function stateLabel(state: CommunityState): MessageKey {
  if (state === "DRAFT") return "community.state.draft";
  if (state === "PENDING_REVIEW") return "community.state.pendingReview";
  if (state === "PUBLISHED") return "community.state.published";
  if (state === "REJECTED") return "community.state.rejected";
  return "community.state.archived";
}

function optionsForType(type: CosmeticType): readonly string[] {
  if (type === "AVATAR_FRAME") return AVATAR_FRAME_PRESETS;
  if (type === "PROFILE_BANNER") return PROFILE_THEME_PRESETS;
  if (type === "PROFILE_EFFECT") return PROFILE_EFFECT_PRESETS;
  if (type === "NAME_EFFECT") return NAME_EFFECT_PRESETS;
  return NAME_FONT_FAMILIES;
}
function defaultBase(type: CosmeticType): string {
  if (type === "PROFILE_EFFECT") return "none";
  if (type === "NAME_EFFECT") return "red";
  if (type === "NAME_FONT") return "InterVariable";
  return "nebula";
}
function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : fallback;
}
function isProfilePreviewType(type: CosmeticType): type is ProfilePreviewType {
  return type === "AVATAR_FRAME" || type === "PROFILE_BANNER" || type === "PROFILE_EFFECT";
}

export function CommunityCosmeticStudio() {
  const { t } = useI18n();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [type, setType] = useState<CosmeticType>("PROFILE_BANNER");
  const [base, setBase] = useState("nebula");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePoints, setPricePoints] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState("#172033");
  const [borderColor, setBorderColor] = useState("#7c8cff");
  const [glowColor, setGlowColor] = useState("#647dff");
  const [customCss, setCustomCss] = useState(
    `.cosmetic-root .profile-card {\n  border-radius: 20px;\n}\n`,
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const visual = useMemo<CosmeticVisualDefinition>(
    () => ({
      backgroundColor,
      borderColor,
      glowColor,
      borderWidth: 2,
      borderRadius: 20,
      glowSize: 16,
      opacity: 1,
      animation: "none",
    }),
    [backgroundColor, borderColor, glowColor],
  );

  const cssPreview = useMemo(() => {
    try {
      return {
        css: sanitizeCommunityCosmeticCss(customCss, "preview").scopedCss,
        error: null as string | null,
      };
    } catch (cause) {
      return { css: "", error: t("community.invalidCss") };
    }
  }, [customCss, t]);

  async function loadSubmissions() {
    try {
      const response = await fetch("/api/cosmetics/submissions", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        submissions?: Submission[];
      } | null;
      if (response.ok)
        setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadSubmissions();
  }, []);

  function changeType(next: CosmeticType) {
    setType(next);
    setBase(defaultBase(next));
  }

  function editSubmission(submission: Submission) {
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(submission.configJson) as Record<string, unknown>;
    } catch {
      /* keep defaults */
    }
    const storedVisual = config.visual as CosmeticVisualDefinition | undefined;
    setDraftId(submission.id);
    setType(submission.type);
    setBase(
      String(
        submission.type === "NAME_FONT"
          ? (config.family ?? "InterVariable")
          : (config.preset ?? defaultBase(submission.type)),
      ),
    );
    setName(submission.name);
    setDescription(submission.description);
    setPricePoints(Number(submission.pricePoints ?? 0));
    if (storedVisual?.backgroundColor) setBackgroundColor(storedVisual.backgroundColor);
    if (storedVisual?.borderColor) setBorderColor(storedVisual.borderColor);
    if (storedVisual?.glowColor) setGlowColor(storedVisual.glowColor);
    setCustomCss(typeof config.communityCssSource === "string" ? config.communityCssSource : "");
    setStatus(t("community.editing", { name: submission.name }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function persist(submitForReview: boolean) {
    if (!name.trim() || !description.trim() || cssPreview.error || busy) return;
    setBusy(submitForReview ? "submit" : "draft");
    setStatus(null);
    const config: Record<string, unknown> = {
      namespace: COSMETIC_VISUAL_NAMESPACE,
      visual,
      customCss,
      ...(type === "NAME_FONT" ? { family: base } : { preset: base }),
    };
    const endpoint = draftId
      ? `/api/cosmetics/submissions/${encodeURIComponent(draftId)}`
      : "/api/cosmetics/submissions";
    try {
      const response = await fetch(endpoint, {
        method: draftId ? "PATCH" : "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          type,
          name: name.trim(),
          description: description.trim(),
          pricePoints,
          config,
          submitForReview,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        submission?: { id?: string; communityState?: CommunityState };
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setStatus(errorMessage(payload, t("community.saveError")));
        return;
      }
      const nextId = payload?.submission?.id ?? draftId;
      setDraftId(submitForReview ? null : (nextId ?? null));
      setStatus(submitForReview ? t("community.submitted") : t("community.draftSaved"));
      if (submitForReview) {
        setName("");
        setDescription("");
      }
      await loadSubmissions();
    } catch {
      setStatus(t("community.saveError"));
    } finally {
      setBusy(null);
    }
  }

  const previewName = name.trim() || t("community.heading");
  const communityStyles =
    cssPreview.css && !cssPreview.error ? [{ id: "preview", css: cssPreview.css }] : undefined;

  return (
    <section className="product-community-studio" aria-labelledby="community-cosmetic-heading">
      <div className="product-store-section__header">
        <div>
          <span className="product-eyebrow">{t("community.builderEyebrow")}</span>
          <h2 id="community-cosmetic-heading">{t("community.builderHeading")}</h2>
          <p>{t("community.builderDescription")}</p>
        </div>
      </div>
      <div className="product-community-studio__layout">
        <div className="product-community-studio__form">
          <label className="product-field-native">
            <span>{t("community.type")}</span>
            <select
              value={type}
              onChange={(event) => changeType(event.target.value as CosmeticType)}
            >
              {COSMETIC_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(typeLabel(value))}
                </option>
              ))}
            </select>
          </label>
          <label className="product-field-native">
            <span>{t(type === "NAME_FONT" ? "community.baseFont" : "community.basePreset")}</span>
            <select value={base} onChange={(event) => setBase(event.target.value)}>
              {optionsForType(type).map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <Input
            label={t("community.name")}
            value={name}
            minLength={2}
            maxLength={120}
            required
            onChange={(event) => setName(event.target.value)}
          />
          <Textarea
            label={t("community.descriptionLabel")}
            value={description}
            minLength={3}
            maxLength={1000}
            rows={3}
            required
            onChange={(event) => setDescription(event.target.value)}
          />
          <Input
            label={t("community.price")}
            type="number"
            min={0}
            max={5000}
            value={pricePoints}
            onChange={(event) => setPricePoints(Number(event.target.value))}
          />
          <div className="product-community-studio__visual-grid">
            <label>
              <span>{t("community.background")}</span>
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
              />
            </label>
            <label>
              <span>{t("community.border")}</span>
              <input
                type="color"
                value={borderColor}
                onChange={(event) => setBorderColor(event.target.value)}
              />
            </label>
            <label>
              <span>{t("community.glow")}</span>
              <input
                type="color"
                value={glowColor}
                onChange={(event) => setGlowColor(event.target.value)}
              />
            </label>
          </div>
          <Textarea
            label={t("community.customCss")}
            value={customCss}
            maxLength={12 * 1024}
            rows={10}
            onChange={(event) => setCustomCss(event.target.value)}
          />
          <small>{t("community.cssHint")}</small>
          {cssPreview.error ? (
            <p className="product-community-studio__css-error" role="alert">
              {cssPreview.error}
            </p>
          ) : null}
          <div className="product-community-studio__actions">
            <Button
              type="button"
              variant="secondary"
              loading={busy === "draft"}
              disabled={!name.trim() || !description.trim() || Boolean(cssPreview.error)}
              onClick={() => void persist(false)}
            >
              {t("community.saveDraft")}
            </Button>
            <Button
              type="button"
              loading={busy === "submit"}
              disabled={!name.trim() || !description.trim() || Boolean(cssPreview.error)}
              onClick={() => void persist(true)}
            >
              {t("community.submit")}
            </Button>
          </div>
          {status ? <p role="status">{status}</p> : null}
        </div>

        <div className="product-community-studio__side">
          <div className="product-community-live-preview">
            {isProfilePreviewType(type) ? (
              <ProfileCosmeticPreview
                type={type}
                preset={base}
                name={previewName}
                visual={visual}
                communityStyles={communityStyles}
                className="product-community-live-preview__profile"
              />
            ) : (
              <div className="cosmetic-root" data-community-cosmetic="preview">
                {cssPreview.css ? <style>{cssPreview.css}</style> : null}
                <div className="profile-card" style={cosmeticVisualStyle(visual)}>
                  <div className="profile-header">
                    <div className="profile-avatar-area" aria-hidden="true">
                      SB
                    </div>
                    <div className="profile-name-area">
                      <strong
                        className={type === "NAME_EFFECT" ? `sb-name-effect--${base}` : undefined}
                        style={type === "NAME_FONT" ? { fontFamily: base } : undefined}
                      >
                        {previewName}
                      </strong>
                      <span>@creator</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <p>{description.trim() || t("community.previewFallback")}</p>
            <small>
              {t(typeLabel(type))} · {base.replaceAll("-", " ")}
            </small>
          </div>
          <Card className="product-community-studio__submissions">
            <div>
              <strong>{t("community.submissions")}</strong>
              <span>
                {loading
                  ? t("community.loading")
                  : t("community.submissionsCount", { count: submissions.length })}
              </span>
            </div>
            {!loading && submissions.length === 0 ? <p>{t("community.empty")}</p> : null}
            {submissions.slice(0, 8).map((submission) => (
              <div className="product-community-studio__submission" key={submission.id}>
                <div>
                  <strong>{submission.name}</strong>
                  <span>{t(typeLabel(submission.type))}</span>
                </div>
                <span data-state={submission.communityState}>
                  {t(stateLabel(submission.communityState))}
                </span>
                {submission.reviewNote ? <small>{submission.reviewNote}</small> : null}
                {submission.communityState === "DRAFT" ||
                submission.communityState === "REJECTED" ? (
                  <button type="button" onClick={() => editSubmission(submission)}>
                    {t("community.edit")}
                  </button>
                ) : null}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </section>
  );
}
