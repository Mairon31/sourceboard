import { createContext, type RouterContextProvider } from "react-router";
import type { AuthenticatedSession } from "../worker/auth/service";
import type { SourceBoardEnvironment } from "../worker/environment";

export interface SourceBoardRequestContext {
  env: SourceBoardEnvironment;
  requestId: string;
  cspNonce: string;
  sessionPromise?: Promise<AuthenticatedSession | null>;
}

export const sourceBoardRequestContext = createContext<SourceBoardRequestContext | null>(null);

export function readSourceBoardRequestContext(
  context: Readonly<RouterContextProvider>,
): SourceBoardRequestContext | null {
  return context.get(sourceBoardRequestContext);
}
