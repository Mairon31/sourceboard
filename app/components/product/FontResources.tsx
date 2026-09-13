import { fontDefinitionByFamily, googleFontCssUrl } from "../../../shared/store/font-providers";

export function FontResources({ families }: { families: readonly string[] }) {
  const definitions = [...new Set(families)]
    .map(fontDefinitionByFamily)
    .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition));
  if (!definitions.length) return null;
  const href = googleFontCssUrl(definitions);
  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={href} />
    </>
  );
}
