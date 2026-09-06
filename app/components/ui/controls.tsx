import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import {
  buttonClassName,
  joinClassNames,
  type ButtonSize,
  type ButtonVariant,
} from "../../../shared/design/component-variants";
import { CheckIcon } from "./icons";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={buttonClassName(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="sb-button__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={joinClassNames("sb-icon-button", className)}
      aria-label={label}
      {...props}
    >
      {children}
    </Button>
  );
});

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="sb-field" htmlFor={fieldId}>
      <span className="sb-field__label">{label}</span>
      <input
        ref={ref}
        id={fieldId}
        className={joinClassNames("sb-input", "focus-ring", className)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {hint ? (
        <span id={hintId} className="sb-field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="sb-field__error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="sb-field" htmlFor={fieldId}>
      <span className="sb-field__label">{label}</span>
      <textarea
        ref={ref}
        id={fieldId}
        className={joinClassNames("sb-textarea", "focus-ring", className)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {hint ? (
        <span id={hintId} className="sb-field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="sb-field__error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
});

export interface SwitchProps extends Omit<
  React.ComponentProps<typeof BaseSwitch.Root>,
  "children" | "className"
> {
  label: string;
  description?: string;
  className?: string;
}

export function Switch({ label, description, className, ...props }: SwitchProps) {
  return (
    <label className={joinClassNames("sb-toggle-row", className)}>
      <span className="sb-toggle-row__copy">
        <span className="sb-toggle-row__label">{label}</span>
        {description ? <span className="sb-toggle-row__description">{description}</span> : null}
      </span>
      <BaseSwitch.Root className="sb-switch focus-ring" {...props}>
        <BaseSwitch.Thumb className="sb-switch__thumb" />
      </BaseSwitch.Root>
    </label>
  );
}

export interface CheckboxProps extends Omit<
  React.ComponentProps<typeof BaseCheckbox.Root>,
  "children" | "className"
> {
  label: string;
  description?: string;
  className?: string;
}

export function Checkbox({ label, description, className, ...props }: CheckboxProps) {
  return (
    <label className={joinClassNames("sb-checkbox-row", className)}>
      <BaseCheckbox.Root className="sb-checkbox focus-ring" {...props}>
        <BaseCheckbox.Indicator className="sb-checkbox__indicator">
          <CheckIcon width="15" height="15" />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span className="sb-toggle-row__copy">
        <span className="sb-toggle-row__label">{label}</span>
        {description ? <span className="sb-toggle-row__description">{description}</span> : null}
      </span>
    </label>
  );
}
