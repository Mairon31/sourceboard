import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { Button, Modal } from "../ui";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function pointerDistance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

export function MediaLightbox({
  open,
  onOpenChange,
  src,
  alt,
  width,
  height,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  returnFocusRef?: { current: HTMLElement | null };
}) {
  const { t } = useI18n();
  const [scale, setScale] = useState(MIN_SCALE);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(
    null,
  );
  const pointerPositions = useRef(new Map<number, { x: number; y: number }>());
  const pinchOrigin = useRef<{ distance: number; scale: number } | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setScale(MIN_SCALE);
      setTranslate({ x: 0, y: 0 });
      setDragging(false);
      dragOrigin.current = null;
      pointerPositions.current.clear();
      pinchOrigin.current = null;
      const focusTarget = returnFocusRef?.current ?? previousFocus.current;
      previousFocus.current = null;
      if (focusTarget?.isConnected) {
        window.setTimeout(() => {
          focusTarget.focus();
        }, 500);
      }
      return;
    }
    previousFocus.current =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange, open, returnFocusRef]);

  function setZoom(nextScale: number) {
    const next = clampScale(nextScale);
    setScale(next);
    if (next === MIN_SCALE) setTranslate({ x: 0, y: 0 });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerPositions.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointerPositions.current.size >= 2) {
      const [left, right] = [...pointerPositions.current.values()];
      if (!left || !right) return;
      pinchOrigin.current = {
        distance: Math.max(1, pointerDistance(left, right)),
        scale,
      };
      dragOrigin.current = null;
      setDragging(false);
      return;
    }
    if (scale <= MIN_SCALE) return;
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: translate.x,
      y: translate.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pointer = pointerPositions.current.get(event.pointerId);
    if (!pointer) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointerPositions.current.size >= 2) {
      const [left, right] = [...pointerPositions.current.values()];
      const origin = pinchOrigin.current;
      if (!left || !right || !origin) return;
      setScale(clampScale(origin.scale * (pointerDistance(left, right) / origin.distance)));
      return;
    }
    const origin = dragOrigin.current;
    if (!origin) return;
    setTranslate({
      x: origin.x + event.clientX - origin.pointerX,
      y: origin.y + event.clientY - origin.pointerY,
    });
  }

  function stopDragging(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerPositions.current.delete(event.pointerId);
    pinchOrigin.current = null;
    const remaining = [...pointerPositions.current.values()][0];
    if (remaining && scale > MIN_SCALE) {
      dragOrigin.current = {
        pointerX: remaining.x,
        pointerY: remaining.y,
        x: translate.x,
        y: translate.y,
      };
      setDragging(true);
      return;
    }
    dragOrigin.current = null;
    setDragging(false);
  }

  return (
    <Modal
      title={t("media.viewer.title")}
      open={open}
      onOpenChange={onOpenChange}
      className="sb-modal--media"
      finalFocus={returnFocusRef}
    >
      <div className="product-media-lightbox">
        <div
          className={`product-media-lightbox__viewport${dragging ? " is-dragging" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onWheel={(event) => {
            event.preventDefault();
            setZoom(scale + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP));
          }}
          tabIndex={0}
          aria-label={t("media.viewer.panHint")}
        >
          <img
            className="product-media-lightbox__image"
            src={src}
            alt={alt || t("media.viewer.imageAlt")}
            width={width}
            height={height}
            draggable={false}
            style={{
              transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
            }}
          />
        </div>
        <div className="product-media-lightbox__controls" aria-label={t("media.viewer.controls")}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label={t("media.viewer.zoomOut")}
            onClick={() => setZoom(scale - SCALE_STEP)}
            disabled={scale <= MIN_SCALE}
          >
            −
          </Button>
          <output aria-live="polite">{Math.round(scale * 100)}%</output>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label={t("media.viewer.zoomIn")}
            onClick={() => setZoom(scale + SCALE_STEP)}
            disabled={scale >= MAX_SCALE}
          >
            +
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t("media.viewer.reset")}
            onClick={() => setZoom(MIN_SCALE)}
            disabled={scale === MIN_SCALE && translate.x === 0 && translate.y === 0}
          >
            {t("media.viewer.reset")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
