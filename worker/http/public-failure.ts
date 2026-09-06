import { PublicHttpError } from "./error";

export function resolvePublicFailure(
  error: unknown,
  fallbackMessage: string,
  forbiddenMessage: string,
): { status: number; message: string } {
  const publicError = error instanceof PublicHttpError ? error : null;
  const candidateStatus = (error as { status?: unknown }).status;
  const status =
    publicError?.status ??
    (typeof candidateStatus === "number" && Number.isInteger(candidateStatus)
      ? candidateStatus
      : 500);
  const message =
    publicError?.publicMessage ??
    (status === 401 ? "Sign in to continue." : status === 403 ? forbiddenMessage : fallbackMessage);
  return { status, message };
}
