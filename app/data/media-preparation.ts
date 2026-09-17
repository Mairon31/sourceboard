import { getMediaImagePolicy, type MediaImagePurpose } from "../../shared/media/policy";

export async function prepareImageForUpload(
  file: File,
  options: { purpose: MediaImagePurpose },
): Promise<File> {
  const policy = getMediaImagePolicy(options.purpose);
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error("IMAGE_DIMENSIONS_INVALID");
    const needsResize = Math.max(bitmap.width, bitmap.height) > policy.maxDimension;
    const needsAggressiveCompression = file.size > policy.aggressiveThresholdBytes;
    if (
      !needsResize &&
      !needsAggressiveCompression &&
      file.type !== "image/jpeg" &&
      file.type !== "image/png"
    ) {
      return file;
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, policy.maxDimension / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);

    const encode = (quality: number) =>
      new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", quality);
      });
    let optimized = await encode(
      needsAggressiveCompression ? policy.aggressiveQuality : policy.clientQuality,
    );
    if (needsAggressiveCompression && (!optimized || optimized.size >= file.size)) {
      const fallbackQuality = Math.max(0.5, policy.aggressiveQuality * 0.75);
      const fallback = await encode(fallbackQuality);
      if (fallback && (!optimized || fallback.size < optimized.size)) optimized = fallback;
    }
    if (!optimized || (!needsResize && optimized.size >= file.size)) return file;

    const stem = file.name.replace(/\.[^.]+$/, "") || "source-image";
    return new File([optimized], `${stem}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
