import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";

export type MediaPickerKind = "GIF" | "STICKER" | "EMOTE";

export interface KlipyMediaItem {
  id: string;
  title: string;
  label: string;
  url: string;
  preview: string;
  type: "GIF" | "STICKER";
  provider: "klipy";
}

export interface EmotePickerItem {
  id: string;
  label: string;
  shortcode: string;
  url: string;
  type: "EMOTE";
  packId: string;
}

interface EmotePack {
  id: string;
  label: string;
  emotes: EmotePickerItem[];
}

export interface SourceBoardStickerItem {
  id: string;
  label: string;
  url: string;
  preview: string;
  type: "STICKER";
  provider: "sourceboard";
  packId: string;
  isAnimated: boolean;
}

interface StickerPack {
  id: string;
  label: string;
  stickers: SourceBoardStickerItem[];
}

export type MediaPickerSelection = KlipyMediaItem | EmotePickerItem | SourceBoardStickerItem;

interface MediaCacheEntry {
  items: KlipyMediaItem[];
  nextPos: string | null;
}

const mediaCache = new Map<string, MediaCacheEntry>();

function mergeMediaItems(current: KlipyMediaItem[], next: KlipyMediaItem[]): KlipyMediaItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of next) byId.set(item.id, item);
  return [...byId.values()];
}

function readNextPosition(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

export function MediaPicker({
  kind,
  onKindChange,
  onSelect,
  onClose,
  allowedKinds,
}: {
  kind: MediaPickerKind;
  onKindChange: (kind: MediaPickerKind) => void;
  onSelect: (item: MediaPickerSelection) => void;
  onClose: () => void;
  allowedKinds?: readonly MediaPickerKind[];
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KlipyMediaItem[]>([]);
  const [packs, setPacks] = useState<EmotePack[]>([]);
  const [stickerPacks, setStickerPacks] = useState<StickerPack[]>([]);
  const [activePackId, setActivePackId] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [nextPos, setNextPos] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string>();
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const paginationRequestRef = useRef<AbortController | null>(null);
  const activeSearchKeyRef = useRef("");
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const emoteScrollRef = useRef<HTMLDivElement | null>(null);
  const packBarRef = useRef<HTMLElement | null>(null);
  const packObserverRef = useRef<IntersectionObserver | null>(null);
  const emotePackCacheRef = useRef<EmotePack[] | null>(null);

  const searchLabel =
    kind === "GIF"
      ? t("mediaPicker.searchGifs")
      : kind === "STICKER"
        ? t("mediaPicker.searchStickers")
        : t("mediaPicker.searchEmotes");
  const visibleKinds = (
    allowedKinds?.length
      ? (["GIF", "STICKER", "EMOTE"] as const).filter((value) => allowedKinds.includes(value))
      : (["GIF", "STICKER", "EMOTE"] as const)
  ) as MediaPickerKind[];

  useEffect(() => {
    setQuery("");
    setStatus(undefined);
  }, [kind]);

  useEffect(() => {
    if (kind !== "STICKER") return;
    const controller = new AbortController();
    void fetch("/api/comments/stickers", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          packs?: StickerPack[];
        } | null;
        if (!response.ok) throw new Error(t("mediaPicker.stickersUnavailable"));
        setStickerPacks(Array.isArray(payload?.packs) ? payload.packs : []);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setStickerPacks([]);
      });
    return () => controller.abort();
  }, [kind, t]);

  useEffect(() => {
    requestRef.current?.abort();
    paginationRequestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadMoreError(undefined);
    setLoadingMore(false);

    if (kind === "EMOTE") {
      setNextPos(null);
      if (emotePackCacheRef.current) {
        setPacks(emotePackCacheRef.current);
        setActivePackId((current) => current ?? emotePackCacheRef.current?.[0]?.id);
        setBusy(false);
        return () => controller.abort();
      }
      setBusy(true);
      void fetch("/api/comments/emotes", { signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            packs?: EmotePack[];
            error?: { message?: string };
          } | null;
          if (!response.ok) {
            throw new Error(payload?.error?.message ?? t("mediaPicker.emotesUnavailable"));
          }
          const next = Array.isArray(payload?.packs) ? payload.packs : [];
          emotePackCacheRef.current = next;
          setPacks(next);
          setActivePackId(next[0]?.id);
          if (!next.length) setStatus(t("mediaPicker.noEmotePacks"));
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setPacks([]);
          setStatus(cause instanceof Error ? cause.message : t("mediaPicker.emotesUnavailable"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
      return () => controller.abort();
    }

    const trimmed = query.trim();
    const cacheKey = `${kind}:${trimmed.toLocaleLowerCase()}`;
    activeSearchKeyRef.current = cacheKey;
    const cached = mediaCache.get(cacheKey);
    if (cached) {
      setItems(cached.items);
      setNextPos(cached.nextPos);
      setBusy(false);
      if (!cached.items.length) {
        setStatus(trimmed ? t("mediaPicker.noResults") : t("mediaPicker.noFeatured"));
      } else {
        setStatus(undefined);
      }
      return () => controller.abort();
    }

    setItems([]);
    setNextPos(null);

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ type: kind });
      if (trimmed) params.set("q", trimmed);
      setBusy(true);
      setStatus(undefined);
      void fetch(`/api/comments/media/search?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            items?: KlipyMediaItem[];
            next?: unknown;
            error?: { message?: string };
          } | null;
          if (!response.ok) {
            throw new Error(payload?.error?.message ?? t("mediaPicker.searchUnavailable"));
          }
          if (activeSearchKeyRef.current !== cacheKey) return;
          const next = mergeMediaItems([], Array.isArray(payload?.items) ? payload.items : []);
          const nextPosition = readNextPosition(payload?.next);
          mediaCache.set(cacheKey, { items: next, nextPos: nextPosition });
          setItems(next);
          setNextPos(nextPosition);
          if (!next.length) {
            setStatus(trimmed ? t("mediaPicker.noResults") : t("mediaPicker.noFeatured"));
          } else {
            setStatus(undefined);
          }
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setItems([]);
          setNextPos(null);
          setStatus(cause instanceof Error ? cause.message : t("mediaPicker.searchUnavailable"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, t]);

  const loadMore = useCallback(async () => {
    if (kind === "EMOTE" || !nextPos || busy || loadingMore) return;
    const trimmed = query.trim();
    const cacheKey = `${kind}:${trimmed.toLocaleLowerCase()}`;
    const position = nextPos;
    const controller = new AbortController();
    paginationRequestRef.current?.abort();
    paginationRequestRef.current = controller;
    setLoadingMore(true);
    setLoadMoreError(undefined);
    try {
      const params = new URLSearchParams({ type: kind, pos: position });
      if (trimmed) params.set("q", trimmed);
      const response = await fetch(`/api/comments/media/search?${params.toString()}`, {
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as {
        items?: KlipyMediaItem[];
        next?: unknown;
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? t("mediaPicker.searchUnavailable"));
      }
      if (activeSearchKeyRef.current !== cacheKey) return;
      const rawNextPosition = readNextPosition(payload?.next);
      const nextPosition = rawNextPosition === position ? null : rawNextPosition;
      setNextPos(nextPosition);
      setItems((current) => {
        const merged = mergeMediaItems(current, Array.isArray(payload?.items) ? payload.items : []);
        mediaCache.set(cacheKey, { items: merged, nextPos: nextPosition });
        return merged;
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (activeSearchKeyRef.current === cacheKey) {
        setLoadMoreError(
          cause instanceof Error ? cause.message : t("mediaPicker.searchUnavailable"),
        );
      }
    } finally {
      if (!controller.signal.aborted && activeSearchKeyRef.current === cacheKey) {
        setLoadingMore(false);
      }
    }
  }, [busy, kind, loadingMore, nextPos, query, t]);

  useEffect(() => {
    const root = resultsRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !nextPos || kind === "EMOTE") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "180px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [kind, loadMore, nextPos]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      pickerRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [kind, items.length, packs.length, stickerPacks.length]);

  const filteredPacks = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return packs;
    return packs
      .map((pack) => ({
        ...pack,
        emotes: pack.emotes.filter(
          (emote) =>
            emote.label.toLocaleLowerCase().includes(value) ||
            emote.shortcode.toLocaleLowerCase().includes(value),
        ),
      }))
      .filter((pack) => pack.emotes.length > 0);
  }, [packs, query]);

  useEffect(() => {
    if (kind !== "EMOTE" || !filteredPacks.length) return;
    if (!filteredPacks.some((pack) => pack.id === activePackId)) {
      setActivePackId(filteredPacks[0]?.id);
    }
  }, [activePackId, filteredPacks, kind]);

  useEffect(() => {
    packObserverRef.current?.disconnect();
    if (kind !== "EMOTE" || !emoteScrollRef.current) return;
    const root = emoteScrollRef.current;
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const section = entry.target as HTMLElement;
          const id = section.dataset.packId;
          if (id) ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        const lastPack = [...root.querySelectorAll<HTMLElement>("[data-pack-id]")].at(-1);
        if (
          lastPack?.dataset.packId &&
          root.scrollTop + root.clientHeight >= root.scrollHeight - 1
        ) {
          setActivePackId(lastPack.dataset.packId);
          return;
        }
        const best = [...ratios.entries()].sort((left, right) => right[1] - left[1])[0];
        if (best && best[1] > 0) setActivePackId(best[0]);
      },
      { root, threshold: [0.1, 0.35, 0.65], rootMargin: "0px 0px -45% 0px" },
    );
    packObserverRef.current = observer;
    for (const section of root.querySelectorAll<HTMLElement>("[data-pack-id]")) {
      observer.observe(section);
    }
    return () => {
      observer.disconnect();
      if (packObserverRef.current === observer) packObserverRef.current = null;
    };
  }, [filteredPacks, kind]);

  useEffect(() => {
    if (!activePackId || !packBarRef.current) return;
    const packBar = packBarRef.current;
    const activeButton = Array.from(
      packBar.querySelectorAll<HTMLButtonElement>("[data-pack-tab-id]"),
    ).find((button) => button.dataset.packTabId === activePackId);
    if (!activeButton) return;
    packBarRef.current.scrollTo({
      left: Math.max(
        0,
        activeButton.offsetLeft - (packBar.clientWidth - activeButton.offsetWidth) / 2,
      ),
      behavior: "auto",
    });
  }, [activePackId]);

  function jumpToPack(packId: string) {
    setActivePackId(packId);
    const root = emoteScrollRef.current;
    if (!root) return;
    const section = Array.from(root.querySelectorAll<HTMLElement>("[data-pack-id]")).find(
      (candidate) => candidate.dataset.packId === packId,
    );
    if (!section) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top =
      section.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTo({
      top: Math.max(0, top),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <div
      ref={pickerRef}
      className="product-comment-media-picker"
      aria-label={t("mediaPicker.aria")}
    >
      <div className="product-comment-media-picker__header">
        <strong>{t("mediaPicker.title")}</strong>
        <button
          className="product-comment-media-picker__close"
          type="button"
          onClick={onClose}
          aria-label={t("mediaPicker.close")}
        >
          ×
        </button>
      </div>
      <div
        className={
          "product-comment-media-picker__tabs" +
          (visibleKinds.length === 1 ? " product-comment-media-picker__tabs--single" : "")
        }
        role="tablist"
        aria-label={t("mediaPicker.typeAria")}
      >
        {visibleKinds.map((value) => {
          const label =
            value === "GIF"
              ? t("mediaPicker.gifs")
              : value === "STICKER"
                ? t("mediaPicker.stickers")
                : t("mediaPicker.emotes");
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-label={label}
              aria-selected={kind === value}
              className={kind === value ? "is-active" : undefined}
              onClick={() => onKindChange(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="product-comment-media-picker__search">
        <input
          type="search"
          value={query}
          aria-label={searchLabel}
          placeholder={searchLabel}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {kind === "EMOTE" ? (
        <>
          {packs.length ? (
            <nav
              ref={packBarRef}
              className="product-comment-media-picker__packbar"
              aria-label={t("mediaPicker.emotePacks")}
            >
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  data-pack-tab-id={pack.id}
                  className={activePackId === pack.id ? "is-active" : undefined}
                  aria-label={pack.label}
                  title={pack.label}
                  onClick={() => jumpToPack(pack.id)}
                >
                  <span className="product-comment-media-picker__packicon">
                    {pack.emotes.slice(0, 4).map((emote) => (
                      <img key={emote.id} src={emote.url} alt="" loading="lazy" />
                    ))}
                  </span>
                </button>
              ))}
            </nav>
          ) : null}
          <div
            ref={emoteScrollRef}
            className="product-comment-media-picker__emote-scroll"
            data-media-kind="emote"
          >
            {filteredPacks.map((pack) => (
              <section key={pack.id} id={`comment-emote-pack-${pack.id}`} data-pack-id={pack.id}>
                <h3>{pack.label}</h3>
                <div className="product-comment-media-picker__emote-grid">
                  {pack.emotes.map((emote) => (
                    <button
                      key={emote.id}
                      type="button"
                      title={`${emote.label} ${emote.shortcode}`}
                      aria-label={t("mediaPicker.addItem", { name: emote.label })}
                      onClick={() => onSelect(emote)}
                    >
                      <img src={emote.url} alt={emote.label} loading="lazy" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : kind === "GIF" ? (
        <div
          ref={resultsRef}
          className="product-comment-media-picker__results product-comment-media-picker__results--gif"
          data-media-kind="gif"
          aria-label={t("mediaPicker.gifResults")}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={t("mediaPicker.addItem", { name: item.title })}
              onClick={() => onSelect(item)}
            >
              <img src={item.url || item.preview} alt={item.title} loading="lazy" />
            </button>
          ))}
          <div
            ref={sentinelRef}
            className="product-comment-media-picker__sentinel"
            aria-hidden="true"
          />
        </div>
      ) : (
        <div className="product-comment-media-picker__sticker-scroll" data-media-kind="sticker">
          {stickerPacks.length ? (
            <div className="product-comment-media-picker__sourceboard-stickers">
              {stickerPacks.map((pack) => (
                <section key={pack.id}>
                  <h3>{pack.label}</h3>
                  <div
                    className="product-comment-media-picker__results product-comment-media-picker__results--sticker"
                    aria-label={t("mediaPicker.packStickers", { name: pack.label })}
                  >
                    {pack.stickers.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="is-sticker"
                        aria-label={t("mediaPicker.addItem", { name: item.label })}
                        onClick={() => onSelect(item)}
                      >
                        <img src={item.url} alt={item.label} loading="lazy" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              <h3>KLIPY</h3>
            </div>
          ) : null}
          <div
            ref={resultsRef}
            className="product-comment-media-picker__results product-comment-media-picker__results--sticker"
            aria-label={t("mediaPicker.stickerResults")}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="is-sticker"
                aria-label={t("mediaPicker.addItem", { name: item.title })}
                onClick={() => onSelect(item)}
              >
                <img src={item.url || item.preview} alt={item.title} loading="lazy" />
              </button>
            ))}
            <div
              ref={sentinelRef}
              className="product-comment-media-picker__sentinel"
              aria-hidden="true"
            />
          </div>
        </div>
      )}
      {busy ? <small role="status">{t("mediaPicker.loading")}</small> : null}
      {!busy && loadingMore ? <small role="status">{t("mediaPicker.loadingMore")}</small> : null}
      {!busy && !loadingMore && loadMoreError ? (
        <div className="product-comment-media-picker__pagination-error" role="alert">
          <span>{loadMoreError}</span>
          <button type="button" onClick={() => void loadMore()}>
            {t("mediaPicker.retry")}
          </button>
        </div>
      ) : null}
      {!busy &&
      !loadingMore &&
      !loadMoreError &&
      kind !== "EMOTE" &&
      items.length > 0 &&
      !nextPos ? (
        <small role="status">{t("mediaPicker.endOfResults")}</small>
      ) : null}
      {!busy && status ? <small role="status">{status}</small> : null}
    </div>
  );
}
