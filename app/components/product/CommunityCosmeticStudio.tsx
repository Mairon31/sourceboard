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
import { cosmeticVisualStyle } from "./cosmetic-visual";
import "./community-cosmetics.css";

type CosmeticType =
  "AVATAR_FRAME" | "PROFILE_BANNER" | "PROFILE_EFFECT" | "NAME_EFFECT" | "NAME_FONT";
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

const TYPE_LABELS: Record<CosmeticType, string> = {
  AVATAR_FRAME: "Avatar Frame",
  PROFILE_BANNER: "Profile Theme",
  PROFILE_EFFECT: "Profile Effect",
  NAME_EFFECT: "Name Effect",
  NAME_FONT: "Font",
};

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

export function CommunityCosmeticStudio() {
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
      return { css: "", error: cause instanceof Error ? cause.message : "Custom CSS is invalid." };
    }
  }, [customCss]);

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
    setStatus(`Editing ${submission.name}.`);
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
        setStatus(errorMessage(payload, "This community cosmetic could not be saved."));
        return;
      }
      const nextId = payload?.submission?.id ?? draftId;
      setDraftId(submitForReview ? null : (nextId ?? null));
      setStatus(
        submitForReview
          ? "Submitted for review. It will not appear publicly until staff approval."
          : "Draft saved.",
      );
      if (submitForReview) {
        setName("");
        setDescription("");
      }
      await loadSubmissions();
    } catch {
      setStatus("This community cosmetic could not be saved. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="product-community-studio" aria-labelledby="community-cosmetic-heading">
      <div className="product-store-section__header">
        <div>
          <span className="product-eyebrow">Cosmetic Builder</span>
          <h2 id="community-cosmetic-heading">Build inside the SourceBoard sandbox</h2>
          <p>
            Choose a base preset, tune safe visual properties, then optionally add CSS scoped to the
            profile cosmetic root.
          </p>
        </div>
      </div>
      <div className="product-community-studio__layout">
        <div className="product-community-studio__form">
          <label className="product-field-native">
            <span>Cosmetic type</span>
            <select
              value={type}
              onChange={(event) => changeType(event.target.value as CosmeticType)}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="product-field-native">
            <span>{type === "NAME_FONT" ? "Base font" : "Base preset"}</span>
            <select value={base} onChange={(event) => setBase(event.target.value)}>
              {optionsForType(type).map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Cosmetic name"
            value={name}
            minLength={2}
            maxLength={120}
            required
            onChange={(event) => setName(event.target.value)}
          />
          <Textarea
            label="Description"
            value={description}
            minLength={3}
            maxLength={1000}
            rows={3}
            required
            onChange={(event) => setDescription(event.target.value)}
          />
          <Input
            label="Price in points (0 = free)"
            type="number"
            min={0}
            max={5000}
            value={pricePoints}
            onChange={(event) => setPricePoints(Number(event.target.value))}
          />
          <div className="product-community-studio__visual-grid">
            <label>
              <span>Background</span>
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
              />
            </label>
            <label>
              <span>Border</span>
              <input
                type="color"
                value={borderColor}
                onChange={(event) => setBorderColor(event.target.value)}
              />
            </label>
            <label>
              <span>Glow</span>
              <input
                type="color"
                value={glowColor}
                onChange={(event) => setGlowColor(event.target.value)}
              />
            </label>
          </div>
          <Textarea
            label="Custom CSS"
            value={customCss}
            maxLength={12 * 1024}
            rows={10}
            onChange={(event) => setCustomCss(event.target.value)}
          />
          <small>
            Allowed roots: .cosmetic-root, .profile-card, .profile-header, .profile-avatar-area and
            .profile-name-area. External URLs, arbitrary selectors, fixed positioning and extreme
            effects are rejected server-side.
          </small>
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
              Save draft
            </Button>
            <Button
              type="button"
              loading={busy === "submit"}
              disabled={!name.trim() || !description.trim() || Boolean(cssPreview.error)}
              onClick={() => void persist(true)}
            >
              Submit for review
            </Button>
          </div>
          {status ? <p role="status">{status}</p> : null}
        </div>

        <div className="product-community-studio__side">
          <div
            className="product-community-live-preview cosmetic-root"
            data-community-cosmetic="preview"
          >
            {cssPreview.css ? <style>{cssPreview.css}</style> : null}
            <div className="profile-card" style={cosmeticVisualStyle(visual)}>
              <div className="profile-header">
                <div className="profile-avatar-area" aria-hidden="true">
                  SB
                </div>
                <div className="profile-name-area">
                  <strong>{name.trim() || "Community cosmetic"}</strong>
                  <span>@creator</span>
                </div>
              </div>
              <p>
                {description.trim() ||
                  "Your public profile preview uses the same sandbox slots that will be available after publication."}
              </p>
              <small>
                {TYPE_LABELS[type]} · {base.replaceAll("-", " ")}
              </small>
            </div>
          </div>
          <Card className="product-community-studio__submissions">
            <div>
              <strong>Your submissions</strong>
              <span>{loading ? "Loading…" : `${submissions.length} total`}</span>
            </div>
            {!loading && submissions.length === 0 ? <p>No community cosmetics yet.</p> : null}
            {submissions.slice(0, 8).map((submission) => (
              <div className="product-community-studio__submission" key={submission.id}>
                <div>
                  <strong>{submission.name}</strong>
                  <span>{TYPE_LABELS[submission.type]}</span>
                </div>
                <span data-state={submission.communityState}>
                  {submission.communityState.replaceAll("_", " ")}
                </span>
                {submission.reviewNote ? <small>{submission.reviewNote}</small> : null}
                {submission.communityState === "DRAFT" ||
                submission.communityState === "REJECTED" ? (
                  <button type="button" onClick={() => editSubmission(submission)}>
                    Edit
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
