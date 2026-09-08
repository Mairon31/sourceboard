import { useEffect, useMemo, useState } from "react";
import {
  AVATAR_FRAME_PRESETS,
  NAME_EFFECT_PRESETS,
  NAME_FONT_FAMILIES,
  PROFILE_BANNER_PRESETS,
  PROFILE_EFFECT_PRESETS,
} from "../../../shared/store/cosmetics";
import {
  COSMETIC_VISUAL_NAMESPACE,
  type CosmeticVisualAnimation,
  type CosmeticVisualDefinition,
} from "../../../shared/store/custom-cosmetics";
import { readCsrfToken } from "../../data/csrf";
import { Button, Card, Input, Textarea } from "../ui";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";

type CosmeticType =
  | "AVATAR_FRAME"
  | "PROFILE_BANNER"
  | "PROFILE_EFFECT"
  | "NAME_EFFECT"
  | "NAME_FONT";

type Submission = {
  id: string;
  type: CosmeticType;
  name: string;
  description: string;
  lifecycleState: string;
  isEnabled: number | boolean;
  reviewState: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: number;
  reviewedAt: number | null;
};

const TYPE_LABELS: Record<CosmeticType, string> = {
  AVATAR_FRAME: "Avatar frame",
  PROFILE_BANNER: "Profile banner",
  PROFILE_EFFECT: "Profile effect",
  NAME_EFFECT: "Name effect",
  NAME_FONT: "Name font",
};

const ANIMATIONS: CosmeticVisualAnimation[] = ["none", "pulse", "shimmer", "float", "spin"];

function optionsForType(type: CosmeticType): readonly string[] {
  if (type === "AVATAR_FRAME") return AVATAR_FRAME_PRESETS;
  if (type === "PROFILE_BANNER") return PROFILE_BANNER_PRESETS;
  if (type === "PROFILE_EFFECT") return PROFILE_EFFECT_PRESETS;
  if (type === "NAME_EFFECT") return NAME_EFFECT_PRESETS;
  return NAME_FONT_FAMILIES;
}

function defaultBase(type: CosmeticType): string {
  if (type === "AVATAR_FRAME") return "nebula";
  if (type === "PROFILE_BANNER") return "nebula";
  if (type === "PROFILE_EFFECT") return "none";
  if (type === "NAME_EFFECT") return "red";
  return "InterVariable";
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

export function CommunityCosmeticStudio() {
  const [type, setType] = useState<CosmeticType>("AVATAR_FRAME");
  const [base, setBase] = useState("nebula");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [foregroundColor, setForegroundColor] = useState("#dbeafe");
  const [backgroundColor, setBackgroundColor] = useState("#172033");
  const [borderColor, setBorderColor] = useState("#7c8cff");
  const [glowColor, setGlowColor] = useState("#647dff");
  const [borderWidth, setBorderWidth] = useState(2);
  const [borderRadius, setBorderRadius] = useState(18);
  const [glowSize, setGlowSize] = useState(16);
  const [opacity, setOpacity] = useState(1);
  const [fontWeight, setFontWeight] = useState(750);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [animation, setAnimation] = useState<CosmeticVisualAnimation>("none");
  const [animationDurationMs, setAnimationDurationMs] = useState(2400);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const visual = useMemo<CosmeticVisualDefinition>(
    () => ({
      foregroundColor,
      backgroundColor,
      borderColor,
      glowColor,
      borderWidth,
      borderRadius,
      glowSize,
      opacity,
      fontWeight,
      letterSpacing,
      animation,
      animationDurationMs,
    }),
    [
      animation,
      animationDurationMs,
      backgroundColor,
      borderColor,
      borderRadius,
      borderWidth,
      fontWeight,
      foregroundColor,
      glowColor,
      glowSize,
      letterSpacing,
      opacity,
    ],
  );

  async function loadSubmissions() {
    try {
      const response = await fetch("/api/cosmetics/submissions", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        submissions?: Submission[];
      } | null;
      if (response.ok) setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubmissions();
  }, []);

  function changeType(nextType: CosmeticType) {
    setType(nextType);
    setBase(defaultBase(nextType));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const config: Record<string, unknown> = {
        namespace: COSMETIC_VISUAL_NAMESPACE,
        visual,
        ...(type === "NAME_FONT" ? { family: base } : { preset: base }),
      };
      const response = await fetch("/api/cosmetics/submissions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ type, name: name.trim(), description: description.trim(), config }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(errorMessage(payload, "This preset could not be submitted."));
        return;
      }
      setName("");
      setDescription("");
      setStatus("Preset submitted as Draft / Pending review.");
      await loadSubmissions();
    } catch {
      setStatus("This preset could not be submitted. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="product-community-studio" aria-labelledby="community-cosmetic-heading">
      <div className="product-store-section__header">
        <div>
          <span className="product-eyebrow">Community Studio</span>
          <h2 id="community-cosmetic-heading">Design a safe cosmetic preset</h2>
          <p>
            Build inside SourceBoard's restricted visual system. Submissions start disabled as Draft /
            Pending review and cannot publish themselves.
          </p>
        </div>
      </div>

      <div className="product-community-studio__layout">
        <form className="product-community-studio__form" onSubmit={(event) => void submit(event)}>
          <label className="product-field-native">
            <span>Cosmetic type</span>
            <select value={type} onChange={(event) => changeType(event.target.value as CosmeticType)}>
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
            label="Preset name"
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

          <div className="product-community-studio__visual-grid">
            <label>
              <span>Foreground</span>
              <input type="color" value={foregroundColor} onChange={(event) => setForegroundColor(event.target.value)} />
            </label>
            <label>
              <span>Background</span>
              <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} />
            </label>
            <label>
              <span>Border</span>
              <input type="color" value={borderColor} onChange={(event) => setBorderColor(event.target.value)} />
            </label>
            <label>
              <span>Glow</span>
              <input type="color" value={glowColor} onChange={(event) => setGlowColor(event.target.value)} />
            </label>
          </div>

          <div className="product-community-studio__range-grid">
            <label>
              <span>Border width · {borderWidth}px</span>
              <input type="range" min="0" max="8" step="1" value={borderWidth} onChange={(event) => setBorderWidth(Number(event.target.value))} />
            </label>
            <label>
              <span>Radius · {borderRadius}px</span>
              <input type="range" min="0" max="64" step="1" value={borderRadius} onChange={(event) => setBorderRadius(Number(event.target.value))} />
            </label>
            <label>
              <span>Glow · {glowSize}px</span>
              <input type="range" min="0" max="48" step="1" value={glowSize} onChange={(event) => setGlowSize(Number(event.target.value))} />
            </label>
            <label>
              <span>Opacity · {opacity.toFixed(2)}</span>
              <input type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} />
            </label>
            <label>
              <span>Weight · {fontWeight}</span>
              <input type="range" min="300" max="900" step="50" value={fontWeight} onChange={(event) => setFontWeight(Number(event.target.value))} />
            </label>
            <label>
              <span>Tracking · {letterSpacing}px</span>
              <input type="range" min="-1" max="6" step="0.25" value={letterSpacing} onChange={(event) => setLetterSpacing(Number(event.target.value))} />
            </label>
          </div>

          <div className="product-community-studio__motion-row">
            <label className="product-field-native">
              <span>Animation</span>
              <select value={animation} onChange={(event) => setAnimation(event.target.value as CosmeticVisualAnimation)}>
                {ANIMATIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="product-field-native">
              <span>Duration</span>
              <select value={animationDurationMs} onChange={(event) => setAnimationDurationMs(Number(event.target.value))}>
                <option value={1200}>1.2s</option>
                <option value={2400}>2.4s</option>
                <option value={4000}>4s</option>
                <option value={8000}>8s</option>
              </select>
            </label>
          </div>

          <div className="product-community-studio__actions">
            <Button type="submit" loading={busy} disabled={!name.trim() || !description.trim()}>
              Submit for review
            </Button>
            <small>External URLs, arbitrary selectors, scripts, imports and raw CSS are never accepted.</small>
          </div>
          {status ? <p role="status">{status}</p> : null}
        </form>

        <div className="product-community-studio__side">
          <div
            className={`product-community-studio__preview${cosmeticVisualClass(visual)}`}
            style={cosmeticVisualStyle(visual)}
          >
            <span>{TYPE_LABELS[type]}</span>
            <strong>{name.trim() || "Community preset"}</strong>
            <small>{base.replaceAll("-", " ")}</small>
          </div>
          <Card className="product-community-studio__submissions">
            <div>
              <strong>Your submissions</strong>
              <span>{loading ? "Loading…" : `${submissions.length} total`}</span>
            </div>
            {!loading && submissions.length === 0 ? (
              <p>No community presets submitted yet.</p>
            ) : null}
            {submissions.slice(0, 6).map((submission) => (
              <div className="product-community-studio__submission" key={submission.id}>
                <div>
                  <strong>{submission.name}</strong>
                  <span>{TYPE_LABELS[submission.type]}</span>
                </div>
                <span data-state={submission.reviewState}>{submission.reviewState.replaceAll("_", " ")}</span>
                {submission.reviewNote ? <small>{submission.reviewNote}</small> : null}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </section>
  );
}
