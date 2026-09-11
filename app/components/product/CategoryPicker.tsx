import { useId, useMemo, useState } from "react";
import {
  POST_CATEGORIES,
  getPostCategory,
  type PostCategorySlug,
} from "../../../shared/posts/categories";
import "./category-picker.css";

interface CategoryPickerProps {
  value: PostCategorySlug | null;
  onChange: (value: PostCategorySlug) => void;
  disabled?: boolean;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function CategoryPicker({ value, onChange, disabled = false }: CategoryPickerProps) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const selected = value ? getPostCategory(value) : null;
  const filtered = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return POST_CATEGORIES;
    return POST_CATEGORIES.filter((category) =>
      [category.label, category.slug, ...category.aliases].some((candidate) =>
        normalizeSearch(candidate).includes(normalized),
      ),
    );
  }, [query]);
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
        Category
      </label>
      <div className="product-category-picker__control">
        <input
          id={`${listboxId}-input`}
          type="search"
          role="combobox"
          aria-label="Category"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOption ? `${listboxId}-${activeOption.slug}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={selected ? selected.label : "Search categories…"}
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
          <span className="product-category-picker__hint">
            Choose the closest match for this request.
          </span>
        )}
      </div>
      {open && !disabled ? (
        <div
          className="product-category-picker__list"
          id={listboxId}
          role="listbox"
          aria-label="Post categories"
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
            <div className="product-category-picker__empty">No matching categories.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
