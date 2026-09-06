import { Toast } from "@base-ui/react/toast";
import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

export interface SourceBoardToastInput {
  title: string;
  description?: string;
}

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="sb-toast glass-panel glass-panel--strong">
      <Toast.Content className="sb-toast__content">
        <div className="sb-toast__text">
          <Toast.Title className="sb-toast__title" />
          <Toast.Description className="sb-toast__description" />
        </div>
        <Toast.Close className="sb-toast__close" aria-label="Dismiss notification">
          <CloseIcon width="16" height="16" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={3} timeout={4500}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="sb-toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

export function useSourceBoardToast() {
  const manager = Toast.useToastManager();

  return {
    show(input: SourceBoardToastInput) {
      manager.add(input);
    },
  };
}
