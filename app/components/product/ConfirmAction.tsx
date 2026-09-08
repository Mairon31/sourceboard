import { useState, type ReactNode } from "react";
import { Button, ConfirmDialog } from "../ui";

export interface ConfirmActionProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  triggerLabel: string;
  children?: ReactNode;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmAction({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  triggerLabel,
  children,
  onConfirm,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {children ?? triggerLabel}
      </Button>
      <ConfirmDialog
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        open={open}
        busy={busy}
        error={error}
        onConfirm={confirm}
        onOpenChange={setOpen}
      />
    </>
  );
}
