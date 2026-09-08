import { useEffect, useMemo, useRef, useState } from "react";

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

export type MediaPickerSelection = KlipyMediaItem | EmotePickerItem;

const mediaCache = new Map<string, KlipyMediaItem[]>();
let emotePackCache: EmotePack[] | null = null;

export function MediaPicker({
  kind,
  onKindChange,
  onSelect,
  onClose,
}: {
  kind: MediaPickerKind;
  onKindChange: (kind: MediaPickerKind) => void;
  onSelect: (item: MediaPickerSelection) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KlipyMediaItem[]>([]);
  const [packs, setPacks] = useState<EmotePack[]>([]);
  const [activePackId, setActivePackId] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery("");
    setStatus(undefined);
  }, [kind]);

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    if (kind === "EMOTE") {
      if (emotePackCache) {
        setPacks(emotePackCache);
        setActivePackId((current) => current ?? emotePackCache?.[0]?.id);
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
          if (!response.ok) throw new Error(payload?.error?.message ?? "Emotes are unavailable.");
          const next = Array.isArray(payload?.packs) ? payload.packs : [];
          emotePackCache = next;
          setPacks(next);
          setActivePackId(next[0]?.id);
          if (!next.length) setStatus("You do not have any emote packs yet.");
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setPacks([]);
          setStatus(cause instanceof Error ? cause.message : "Emotes are unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
      return () => controller.abort();
    }

    const trimmed = query.trim();
    const cacheKey = `${kind}:${trimmed.toLocaleLowerCase()}`;
    const cached = mediaCache.get(cacheKey);
    if (cached) {
      setItems(cached);
      setBusy(false);
      if (!cached.length) setStatus(trimmed ? "No results found." : "No featured media found.");
      return () => controller.abort();
    }

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ type: kind });
      if (trimmed) params.set("q", trimmed);
      setBusy(true);
      setStatus(undefined);
      void fetch(`/api/comments/media/search?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            items?: KlipyMediaItem[];
            error?: { message?: string };
          } | null;
          if (!response.ok)
            throw new Error(payload?.error?.message ?? "Media search is unavailable.");
          const next = Array.isArray(payload?.items) ? payload.items : [];
          mediaCache.set(cacheKey, next);
          setItems(next);
          if (!next.length) setStatus(trimmed ? "No results found." : "No featured media found.");
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setItems([]);
          setStatus(cause instanceof Error ? cause.message : "Media search is unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query]);

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

  function jumpToPack(packId: string) {
    setActivePackId(packId);
    document
      .getElementById(`comment-emote-pack-${packId}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div className="product-comment-media-picker" aria-label="Media picker">
      <div className="product-comment-media-picker__header">
        <strong>Add media</strong>
        <button
          className="product-comment-media-picker__close"
          type="button"
          onClick={onClose}
          aria-label="Close media picker"
        >
          ×
        </button>
      </div>
      <div className="product-comment-media-picker__tabs" role="tablist" aria-label="Media type">
        {(["GIF", "STICKER", "EMOTE"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-label={value === "GIF" ? "GIFs" : value === "STICKER" ? "Stickers" : "Emotes"}
            aria-selected={kind === value}
            className={kind === value ? "is-active" : undefined}
            onClick={() => onKindChange(value)}
          >
            {value === "GIF" ? "GIFs" : value === "STICKER" ? "Stickers" : "Emotes"}
          </button>
        ))}
      </div>
      <div className="product-comment-media-picker__search">
        <input
          type="search"
          value={query}
          aria-label={`Search ${kind.toLowerCase()}s`}
          placeholder={
            kind === "GIF"
              ? "Search GIFs"
              : kind === "STICKER"
                ? "Search stickers"
                : "Search emotes"
          }
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {kind === "EMOTE" ? (
        <>
          {packs.length ? (
            <nav className="product-comment-media-picker__packbar" aria-label="Emote packs">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
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
            className="product-comment-media-picker__emote-scroll"
            onScroll={(event) => {
              const root = event.currentTarget;
              const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-pack-id]"));
              const current = sections.reduce<HTMLElement | null>((best, section) => {
                if (!best) return section;
                return Math.abs(section.offsetTop - root.scrollTop) <
                  Math.abs(best.offsetTop - root.scrollTop)
                  ? section
                  : best;
              }, null);
              if (current?.dataset.packId) setActivePackId(current.dataset.packId);
            }}
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
                      aria-label={`Add ${emote.label}`}
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
      ) : (
        <div className="product-comment-media-picker__results" aria-label={`${kind} results`}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.type === "STICKER" ? "is-sticker" : undefined}
              aria-label={`Add ${item.title}`}
              onClick={() => onSelect(item)}
            >
              <img src={item.url || item.preview} alt={item.title} loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {busy ? <small role="status">Loading…</small> : null}
      {!busy && status ? <small role="status">{status}</small> : null}
    </div>
  );
}
