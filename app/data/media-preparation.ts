export async function prepareImageForUpload(
  file: File,
  options: { maxDimension: number },
): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error("IMAGE_DIMENSIONS_INVALID");
    const needsResize = Math.max(bitmap.width, bitmap.height) > options.maxDimension;
    if (!needsResize && file.type !== "image/jpeg" && file.type !== "image/png") return file;

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, options.maxDimension / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);

    const optimized = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.86);
    });
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
