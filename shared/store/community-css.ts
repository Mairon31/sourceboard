export const COMMUNITY_CSS_MAX_BYTES = 12 * 1024;
export const COMMUNITY_CSS_MAX_KEYFRAMES = 4;
export const COMMUNITY_CSS_MAX_RULES = 24;

export interface SanitizedCommunityCss {
  sourceCss: string;
  scopedCss: string;
}

export const COMMUNITY_CSS_ALLOWED_SELECTORS = [
  ".cosmetic-root",
  ".cosmetic-root .profile-card",
  ".cosmetic-root .profile-card::before",
  ".cosmetic-root .profile-card::after",
  ".cosmetic-root .profile-header",
  ".cosmetic-root .profile-header::before",
  ".cosmetic-root .profile-header::after",
  ".cosmetic-root .profile-avatar-area",
  ".cosmetic-root .profile-avatar-area::before",
  ".cosmetic-root .profile-avatar-area::after",
  ".cosmetic-root .profile-name-area",
  ".cosmetic-root .profile-name-area::before",
  ".cosmetic-root .profile-name-area::after",
] as const;

export const COMMUNITY_CSS_ALLOWED_PROPERTIES = [
  "color",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-width",
  "border-radius",
  "box-shadow",
  "opacity",
  "transform",
  "filter",
  "overflow",
  "font-weight",
  "letter-spacing",
  "text-transform",
  "content",
  "animation",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
] as const;

const ALLOWED_SELECTORS = new Set<string>(COMMUNITY_CSS_ALLOWED_SELECTORS);
const ALLOWED_PROPERTIES = new Set<string>(COMMUNITY_CSS_ALLOWED_PROPERTIES);

const KEYFRAME_PROPERTIES = new Set(["opacity", "transform", "filter"]);
const CSS_LENGTH_TOKEN =
  /([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(px|rem|em|ex|ch|cap|ic|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|svi|svb|svmin|svmax|lvw|lvh|lvi|lvb|lvmin|lvmax|dvw|dvh|dvi|dvb|dvmin|dvmax|cm|mm|q|in|pt|pc)\b/gi;
const CSS_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const CSS_PIXEL = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))px$/i;
const CSS_DEGREE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))deg$/i;

function invalid(message: string): never {
  throw new Error(message);
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function validateGlobalSafety(source: string): void {
  if (new TextEncoder().encode(source).byteLength > COMMUNITY_CSS_MAX_BYTES)
    invalid("Custom CSS must be 12 KB or smaller.");
  if (source.includes("\\"))
    invalid("CSS escape sequences are not allowed in community cosmetics.");
  if (/@import\b/i.test(source)) invalid("@import is not allowed in community cosmetics.");
  if (/url\s*\(/i.test(source)) invalid("url() is not allowed in community cosmetics.");
  if (/(?:-webkit-)?image-set\s*\(|\bimage\s*\(/i.test(source))
    invalid("External image functions are not allowed in community cosmetics.");
  if (/expression\s*\(|javascript:|vbscript:|behavior\s*:/i.test(source))
    invalid("External or executable CSS is not allowed.");
  if (/<\/?(?:style|script|iframe)\b/i.test(source)) invalid("HTML is not allowed in custom CSS.");
}

type RawRule = { header: string; body: string };

function parseRules(source: string): RawRule[] {
  const rules: RawRule[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    while (cursor < source.length && /\s/.test(source[cursor] ?? "")) cursor += 1;
    if (cursor >= source.length) break;
    const open = source.indexOf("{", cursor);
    if (open < 0) invalid("Every CSS rule must have a declaration block.");
    const header = source.slice(cursor, open).trim();
    if (!header) invalid("A CSS selector is required.");
    let depth = 1;
    let index = open + 1;
    for (; index < source.length && depth > 0; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
    }
    if (depth !== 0) invalid("Custom CSS contains an unclosed block.");
    rules.push({ header, body: source.slice(open + 1, index - 1).trim() });
    cursor = index;
  }
  return rules;
}

function validateBoundedLengths(
  value: string,
  maximum: number,
  property: string,
  options: { allowPercent?: boolean; inspectPercent?: boolean } = {},
): void {
  if (/\b(?:calc|min|max|clamp)\s*\(/i.test(value))
    invalid(`${property} may not use CSS math functions.`);
  for (const match of value.matchAll(CSS_LENGTH_TOKEN)) {
    const amount = Math.abs(Number(match[1]));
    const unit = match[2]?.toLowerCase();
    if (unit !== "px") invalid(`${property} must use bounded pixel values.`);
    if (amount > maximum) invalid(`${property} exceeds the allowed visual bounds.`);
  }
  if (options.inspectPercent) {
    for (const match of value.matchAll(/([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*%/g)) {
      if (!options.allowPercent) invalid(`${property} may not use percentages.`);
      if (Math.abs(Number(match[1])) > 100)
        invalid(`${property} percentage exceeds the allowed visual bounds.`);
    }
  }
}

function splitTransformArgs(raw: string): string[] {
  const normalized = raw.trim();
  if (!normalized) return [];
  return normalized.split(/\s*,\s*|\s+/).filter(Boolean);
}

function validatePixelTransformArg(raw: string): void {
  const value = raw.trim();
  if (/^[+-]?0(?:\.0+)?$/.test(value)) return;
  const match = value.match(CSS_PIXEL);
  if (!match || Math.abs(Number(match[1])) > 18)
    invalid("Transform translation must stay within 18px.");
}

function validateScaleTransformArg(raw: string): void {
  const value = raw.trim();
  if (!CSS_NUMBER.test(value)) invalid("Transform scale must be a plain number.");
  const scale = Number(value);
  if (scale < 0.75 || scale > 1.25) invalid("Transform scale must stay between 0.75 and 1.25.");
}

function validateRotateTransformArg(raw: string): void {
  const value = raw.trim();
  if (/^[+-]?0(?:\.0+)?$/.test(value)) return;
  const match = value.match(CSS_DEGREE);
  if (!match || Math.abs(Number(match[1])) > 360)
    invalid("Transform rotation must stay within 360deg.");
}

function validateTransform(value: string): void {
  if (/\b(?:matrix|perspective|translate3d|scale3d|rotate3d)\s*\(/i.test(value))
    invalid("That transform is not allowed.");
  if (/\b(?:calc|min|max|clamp)\s*\(/i.test(value))
    invalid("Transform math functions are not allowed.");

  const pattern = /(translate(?:X|Y)?|scale(?:X|Y)?|rotate)\(([^()]*)\)/gi;
  let cursor = 0;
  let matched = false;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (value.slice(cursor, index).trim())
      invalid("Only bounded translate, scale and rotate transforms are allowed.");
    matched = true;
    const name = (match[1] ?? "").toLowerCase();
    const args = splitTransformArgs(match[2] ?? "");
    if (name === "translate") {
      if (args.length < 1 || args.length > 2)
        invalid("translate() accepts one or two bounded pixel values.");
      for (const arg of args) validatePixelTransformArg(arg);
    } else if (name === "translatex" || name === "translatey") {
      if (args.length !== 1) invalid(`${name}() accepts one bounded pixel value.`);
      validatePixelTransformArg(args[0] ?? "");
    } else if (name === "scale") {
      if (args.length < 1 || args.length > 2)
        invalid("scale() accepts one or two bounded numeric values.");
      for (const arg of args) validateScaleTransformArg(arg);
    } else if (name === "scalex" || name === "scaley") {
      if (args.length !== 1) invalid(`${name}() accepts one bounded numeric value.`);
      validateScaleTransformArg(args[0] ?? "");
    } else {
      if (args.length !== 1) invalid("rotate() accepts one bounded angle.");
      validateRotateTransformArg(args[0] ?? "");
    }
    cursor = index + match[0].length;
  }
  if (!matched || value.slice(cursor).trim())
    invalid("Only bounded translate, scale and rotate transforms are allowed.");
}

function validateFilterAmount(raw: string, label: string): void {
  const value = raw.trim();
  const percent = value.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))%$/);
  const amount = percent
    ? Number(percent[1]) / 100
    : CSS_NUMBER.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(amount) || amount < 0 || amount > 2)
    invalid(`${label} must stay between 0 and 200%.`);
}

function validateBlurFilterArg(raw: string): void {
  const value = raw.trim();
  if (/^[+-]?0(?:\.0+)?$/.test(value)) return;
  const match = value.match(CSS_PIXEL);
  const amount = match ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(amount) || amount < 0 || amount > 12)
    invalid("Blur must stay between 0 and 12px.");
}

function validateHueFilterArg(raw: string): void {
  const value = raw.trim();
  if (/^[+-]?0(?:\.0+)?$/.test(value)) return;
  const match = value.match(CSS_DEGREE);
  if (!match || Math.abs(Number(match[1])) > 360)
    invalid("Hue rotation must stay within 360deg.");
}

function validateFilter(value: string): void {
  if (/drop-shadow|url\s*\(/i.test(value)) invalid("That filter is not allowed.");
  if (/\b(?:calc|min|max|clamp)\s*\(/i.test(value))
    invalid("Filter math functions are not allowed.");

  const pattern = /(blur|brightness|saturate|contrast|hue-rotate)\(([^()]*)\)/gi;
  let cursor = 0;
  let matched = false;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (value.slice(cursor, index).trim()) invalid("Only bounded color filters are allowed.");
    matched = true;
    const name = (match[1] ?? "").toLowerCase();
    const raw = (match[2] ?? "").trim();
    if (!raw || raw.includes(",") || /\s/.test(raw))
      invalid(`${name}() accepts exactly one bounded value.`);
    if (name === "blur") validateBlurFilterArg(raw);
    else if (name === "hue-rotate") validateHueFilterArg(raw);
    else validateFilterAmount(raw, name);
    cursor = index + match[0].length;
  }
  if (!matched || value.slice(cursor).trim()) invalid("Only bounded color filters are allowed.");
}

function durationMs(value: string): number[] {
  return [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/gi)].map((match) =>
    match[2]?.toLowerCase() === "s" ? Number(match[1]) * 1000 : Number(match[1]),
  );
}

function validateAnimation(value: string, property: string): void {
  for (const duration of durationMs(value)) {
    if (duration < 800 || duration > 20_000)
      invalid("Animations must use durations between 800ms and 20s.");
  }
  if (property === "animation-iteration-count") {
    const normalized = value.trim().toLowerCase();
    if (normalized !== "infinite" && (!/^\d+$/.test(normalized) || Number(normalized) > 6))
      invalid("Animation iteration count is too high.");
  }
}

function sanitizeDeclarations(
  body: string,
  keyframeNames: Map<string, string>,
  keyframe = false,
): string {
  const declarations = body
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (declarations.length > 64) invalid("Too many declarations in one cosmetic rule.");
  const output: string[] = [];
  for (const declaration of declarations) {
    const colon = declaration.indexOf(":");
    if (colon <= 0) invalid("Every declaration must use property: value syntax.");
    const property = declaration.slice(0, colon).trim().toLowerCase();
    let value = declaration.slice(colon + 1).trim();
    if (!value || /!important/i.test(value) || /[{}<>]/.test(value))
      invalid("That CSS declaration is not allowed.");
    if (/\bvar\s*\(/i.test(value)) invalid("var() is not allowed in community cosmetics.");
    if (property.startsWith("--")) {
      if (keyframe || property !== "--accent")
        invalid("Only --accent may be defined by community cosmetics.");
      output.push(`${property}: ${value}`);
      continue;
    }
    const allowed = keyframe ? KEYFRAME_PROPERTIES : ALLOWED_PROPERTIES;
    if (!allowed.has(property)) invalid(`${property} is not allowlisted for community cosmetics.`);
    if (property === "opacity") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0.15 || numeric > 1)
        invalid("Opacity must stay between 0.15 and 1.");
    }
    if (property === "border-width")
      validateBoundedLengths(value, 8, property, { inspectPercent: true });
    if (property === "border-radius")
      validateBoundedLengths(value, 64, property, { allowPercent: true, inspectPercent: true });
    if (property === "box-shadow") validateBoundedLengths(value, 64, property);
    if (property === "letter-spacing")
      validateBoundedLengths(value, 8, property, { inspectPercent: true });
    if (property === "transform") validateTransform(value);
    if (property === "filter") validateFilter(value);
    if (property === "overflow" && !/^(hidden|clip)$/i.test(value))
      invalid("Overflow may only be hidden or clip.");
    if (property === "font-weight") {
      const weight = Number(value);
      if (!Number.isInteger(weight) || weight < 300 || weight > 900)
        invalid("Font weight must be between 300 and 900.");
    }
    if (property === "text-transform" && !/^(none|uppercase|lowercase|capitalize)$/i.test(value))
      invalid("That text transform is not allowed.");
    if (property === "content" && !/^(?:"[^"\\]{0,80}"|'[^'\\]{0,80}')$/.test(value))
      invalid("Pseudo-element content must be a short text literal.");
    if (property.startsWith("animation")) {
      validateAnimation(value, property);
      for (const [original, scoped] of keyframeNames) {
        value = value.replace(
          new RegExp(`\\b${original.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "g"),
          scoped,
        );
      }
    }
    output.push(`${property}: ${value}`);
  }
  return output.join("; ");
}

function sanitizeKeyframeBody(body: string, keyframeNames: Map<string, string>): string {
  const frames = parseRules(body);
  if (!frames.length || frames.length > 16) invalid("Keyframes must contain 1-16 frames.");
  return frames
    .map((frame) => {
      const parts = frame.header.split(",").map((part) => part.trim());
      if (
        parts.some(
          (part) => part !== "from" && part !== "to" && !/^(?:100|\d{1,2})(?:\.\d+)?%$/.test(part),
        )
      )
        invalid("Keyframes may only use from, to or percentages.");
      return `${parts.join(", ")} { ${sanitizeDeclarations(frame.body, keyframeNames, true)} }`;
    })
    .join("\n");
}

export function sanitizeCommunityCosmeticCss(
  source: string,
  cosmeticId: string,
): SanitizedCommunityCss {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cosmeticId)) invalid("Community cosmetic id is invalid.");
  const cleaned = stripComments(String(source ?? ""));
  if (!cleaned) return { sourceCss: "", scopedCss: "" };
  validateGlobalSafety(cleaned);
  const rules = parseRules(cleaned);
  if (rules.length > COMMUNITY_CSS_MAX_RULES) invalid("Custom CSS contains too many rules.");

  const keyframes = rules.filter((rule) => /^@keyframes\s+/i.test(rule.header));
  if (keyframes.length > COMMUNITY_CSS_MAX_KEYFRAMES)
    invalid("Use no more than four keyframe animations.");
  const keyframeNames = new Map<string, string>();
  for (const rule of keyframes) {
    const match = rule.header.match(/^@keyframes\s+([A-Za-z_][A-Za-z0-9_-]{0,31})$/i);
    if (!match) invalid("Only standard @keyframes rules are allowed.");
    const name = match[1] ?? "";
    keyframeNames.set(name, `sbcc-${cosmeticId}-${name}`);
  }

  const root = `[data-community-cosmetic~="${cosmeticId}"]`;
  const output: string[] = [];
  for (const rule of rules) {
    if (/^@keyframes\s+/i.test(rule.header)) {
      const name = rule.header.match(/^@keyframes\s+([A-Za-z_][A-Za-z0-9_-]{0,31})$/i)?.[1];
      if (!name) invalid("Invalid keyframe name.");
      output.push(
        `@keyframes ${keyframeNames.get(name)} {\n${sanitizeKeyframeBody(rule.body, keyframeNames)}\n}`,
      );
      continue;
    }
    if (rule.header.startsWith("@")) invalid("Only @keyframes at-rules are allowed.");
    const selectors = rule.header.split(",").map((selector) => selector.trim());
    if (!selectors.length || selectors.some((selector) => !ALLOWED_SELECTORS.has(selector)))
      invalid("Custom CSS selectors must stay inside .cosmetic-root and approved profile slots.");
    const scoped = selectors
      .map((selector) => selector.replace(/^\.cosmetic-root/, root))
      .join(", ");
    output.push(`${scoped} { ${sanitizeDeclarations(rule.body, keyframeNames)} }`);
  }
  return { sourceCss: cleaned, scopedCss: output.join("\n") };
}