import { useId, useMemo, useState } from "react";
import {
  POST_CATEGORIES,
  getPostCategory,
  type PostCategory,
  type PostCategorySlug,
} from "../../../shared/posts/categories";
import { useI18n } from "../../i18n/I18nProvider";
import "./category-picker.css";

interface CategoryPickerProps {
  value: PostCategorySlug | null;
  onChange: (value: PostCategorySlug) => void;
  disabled?: boolean;
  categories?: readonly PostCategory[];
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function CategoryPicker({
  value,
  onChange,
  disabled = false,
  categories = POST_CATEGORIES,
}: CategoryPickerProps) {
  const { t } = useI18n();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const selected = value
    ? (categories.find((category) => category.slug === value) ?? getPostCategory(value))
    : null;
  const filtered = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return categories;
    return categories.filter((category) =>
      [category.label, category.slug, ...category.aliases].some((candidate) =>
        normalizeSearch(candidate).includes(normalized),
      ),
    );
  }, [categories, query]);
  const activeIndex = filtered.length ? Math.min(highlightedIndex, filtered.length - 1) : -1;
  const activeOption = activeIndex >= 0 ? filtered[activeIndex] : undefined;

  function choose(slug: PostCategorySlug) {
    onChange(slug);
    setQuery("");
    setOpen(false);
    setHighlightedIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((current) =>
        filtered.length ? (Math.min(current, filtered.length - 1) + 1) % filtered.length : 0,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((current) =>
        filtered.length
          ? (Math.min(current, filtered.length - 1) - 1 + filtered.length) % filtered.length
          : 0,
      );
      return;
    }
    if (event.key === "Enter" && open && activeOption) {
      event.preventDefault();
      choose(activeOption.slug);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="product-category-picker">
      <label className="product-category-picker__label" htmlFor={`${listboxId}-input`}>
        {t("categoryPicker.label")}
      </label>
      <div className="product-category-picker__control">
        <input
          id={`${listboxId}-input`}
          type="search"
          role="combobox"
          aria-label={t("categoryPicker.label")}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOption ? `${listboxId}-${activeOption.slug}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={selected ? selected.label : t("categoryPicker.search")}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setHighlightedIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => window.setTimeout(() => setOpen(false), 0)}
        />
        {selected ? (
          <div className="product-category-picker__selected" aria-live="polite">
            <strong>{selected.label}</strong>
            <span>{selected.description}</span>
          </div>
        ) : (
          <span className="product-category-picker__hint">{t("categoryPicker.hint")}</span>
        )}
      </div>
      {open && !disabled ? (
        <div
          className="product-category-picker__list"
          id={listboxId}
          role="listbox"
          aria-label={t("categoryPicker.listAria")}
        >
          {filtered.length ? (
            filtered.map((category, index) => (
              <button
                id={`${listboxId}-${category.slug}`}
                key={category.slug}
                type="button"
                role="option"
                aria-selected={value === category.slug}
                className={index === activeIndex ? "is-highlighted" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => choose(category.slug)}
              >
                <strong>{category.label}</strong>
                <span>{category.description}</span>
              </button>
            ))
          ) : (
            <div className="product-category-picker__empty">{t("categoryPicker.empty")}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
