import {
  POST_CATEGORIES,
  isPostCategorySlug,
  type PostCategory,
} from "../../shared/posts/categories";
import { SUPPORTED_LOCALES, type Locale } from "../../shared/i18n/locales";

export interface CategoryTranslation {
  name: string;
  description: string;
}

export interface CategoryView {
  slug: string;
  name: string;
  description: string;
  aliases: string[];
  isNsfw: boolean;
  isArchived: boolean;
  noindex: boolean;
  translations: Partial<Record<Locale, CategoryTranslation>>;
}

export interface CategoryInput {
  slug: string;
  name: string;
  description?: string;
  aliases?: string[];
  isNsfw?: boolean;
  isArchived?: boolean;
  noindex?: boolean;
  translations?: Partial<Record<Locale, CategoryTranslation>>;
}

interface CategoryRow {
  slug: string;
  name: string;
  description: string;
  aliases_json: string;
  is_nsfw: number;
  is_archived: number;
  noindex: number;
  created_at: number;
  updated_at: number;
}

interface TranslationRow {
  category_slug: string;
  locale: string;
  name: string;
  description: string;
}

export function isMissingCategorySchemaError(error: unknown): boolean {
  return /no such table|no such column/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

function clean(value: unknown, max: number, field: string, required = false): string {
  if (typeof value !== "string") throw new Error(`CATEGORY_${field.toUpperCase()}_INVALID`);
  const result = value.replace(/\s+/g, " ").trim();
  if ((required && !result) || result.length > max) {
    throw new Error(`CATEGORY_${field.toUpperCase()}_INVALID`);
  }
  return result;
}

function normalizeInput(input: CategoryInput): Required<
  Pick<
    CategoryInput,
    "slug" | "name" | "description" | "aliases" | "isNsfw" | "isArchived" | "noindex"
  >
> & {
  translations: Partial<Record<Locale, CategoryTranslation>>;
} {
  const slug = clean(input.slug, 64, "slug", true).toLowerCase();
  if (!isPostCategorySlug(slug)) throw new Error("CATEGORY_SLUG_INVALID");
  const name = clean(input.name, 120, "name", true);
  const description = clean(input.description ?? "", 500, "description");
  const aliases = Array.from(
    new Set(
      (input.aliases ?? [])
        .map((alias) => clean(alias, 60, "alias"))
        .filter(Boolean)
        .map((alias) => alias.toLowerCase()),
    ),
  ).slice(0, 20);
  const translations: Partial<Record<Locale, CategoryTranslation>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const translation = input.translations?.[locale];
    if (!translation) continue;
    translations[locale] = {
      name: clean(translation.name, 120, "translation_name", true),
      description: clean(translation.description, 500, "translation_description"),
    };
  }
  return {
    slug,
    name,
    description,
    aliases,
    isNsfw: Boolean(input.isNsfw),
    isArchived: Boolean(input.isArchived),
    noindex: Boolean(input.noindex),
    translations,
  };
}

function parseAliases(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function fallbackCategory(category: PostCategory): CategoryView {
  return {
    slug: category.slug,
    name: category.label,
    description: category.description,
    aliases: [...category.aliases],
    isNsfw: Boolean(category.isNsfw),
    isArchived: Boolean(category.isArchived),
    noindex: Boolean(category.noindex),
    translations: { en: { name: category.label, description: category.description } },
  };
}

export function createCategoryService(db: D1Database) {
  async function list(options: { includeArchived?: boolean } = {}): Promise<CategoryView[]> {
    const rows = await db
      .prepare(
        `SELECT slug, name, description, aliases_json, is_nsfw, is_archived, noindex, created_at, updated_at
         FROM post_categories
         ${options.includeArchived ? "" : "WHERE is_archived = 0"}
         ORDER BY name COLLATE NOCASE, slug`,
      )
      .all<CategoryRow>();
    const translations = await db
      .prepare(
        `SELECT category_slug, locale, name, description
         FROM post_category_translations
         WHERE category_slug IN (SELECT slug FROM post_categories)`,
      )
      .all<TranslationRow>();
    const bySlug = new Map<string, Partial<Record<Locale, CategoryTranslation>>>();
    for (const row of translations.results) {
      if (!SUPPORTED_LOCALES.includes(row.locale as Locale)) continue;
      const current = bySlug.get(row.category_slug) ?? {};
      current[row.locale as Locale] = { name: row.name, description: row.description };
      bySlug.set(row.category_slug, current);
    }
    return rows.results.map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
      aliases: parseAliases(row.aliases_json),
      isNsfw: Boolean(row.is_nsfw),
      isArchived: Boolean(row.is_archived),
      noindex: Boolean(row.noindex),
      translations: bySlug.get(row.slug) ?? {},
    }));
  }

  async function get(
    slug: string,
    options: { allowArchived?: boolean } = {},
  ): Promise<CategoryView | null> {
    if (!isPostCategorySlug(slug)) return null;
    const row = await db
      .prepare(
        `SELECT slug, name, description, aliases_json, is_nsfw, is_archived, noindex, created_at, updated_at
         FROM post_categories WHERE slug = ? ${options.allowArchived ? "" : "AND is_archived = 0"}`,
      )
      .bind(slug)
      .first<CategoryRow>();
    if (!row) return null;
    const translations = await db
      .prepare(
        "SELECT category_slug, locale, name, description FROM post_category_translations WHERE category_slug = ?",
      )
      .bind(slug)
      .all<TranslationRow>();
    const localized: Partial<Record<Locale, CategoryTranslation>> = {};
    for (const translation of translations.results) {
      if (SUPPORTED_LOCALES.includes(translation.locale as Locale)) {
        localized[translation.locale as Locale] = {
          name: translation.name,
          description: translation.description,
        };
      }
    }
    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      aliases: parseAliases(row.aliases_json),
      isNsfw: Boolean(row.is_nsfw),
      isArchived: Boolean(row.is_archived),
      noindex: Boolean(row.noindex),
      translations: localized,
    };
  }

  function statements(
    input: ReturnType<typeof normalizeInput>,
    originalSlug: string | null,
    now: number,
  ) {
    const slugChanged = originalSlug !== null && originalSlug !== input.slug;
    const list: D1PreparedStatement[] = [];
    if (originalSlug === null || slugChanged) {
      list.push(
        db
          .prepare(
            `INSERT INTO post_categories (slug,name,description,aliases_json,is_nsfw,is_archived,noindex,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            input.slug,
            input.name,
            input.description,
            JSON.stringify(input.aliases),
            input.isNsfw ? 1 : 0,
            input.isArchived ? 1 : 0,
            input.noindex ? 1 : 0,
            now,
            now,
          ),
      );
    } else {
      list.push(
        db
          .prepare(
            `UPDATE post_categories SET name=?, description=?, aliases_json=?, is_nsfw=?, is_archived=?, noindex=?, updated_at=? WHERE slug=?`,
          )
          .bind(
            input.name,
            input.description,
            JSON.stringify(input.aliases),
            input.isNsfw ? 1 : 0,
            input.isArchived ? 1 : 0,
            input.noindex ? 1 : 0,
            now,
            input.slug,
          ),
      );
    }
    if (originalSlug && slugChanged) {
      list.push(
        db
          .prepare("UPDATE posts SET category_slug = ? WHERE category_slug = ?")
          .bind(input.slug, originalSlug),
      );
    }
    if (originalSlug) {
      list.push(
        db
          .prepare("DELETE FROM post_category_translations WHERE category_slug = ?")
          .bind(originalSlug),
      );
      if (slugChanged)
        list.push(db.prepare("DELETE FROM post_categories WHERE slug = ?").bind(originalSlug));
    }
    for (const locale of SUPPORTED_LOCALES) {
      const translation = input.translations[locale];
      if (!translation) continue;
      list.push(
        db
          .prepare(
            "INSERT INTO post_category_translations (category_slug,locale,name,description) VALUES (?,?,?,?)",
          )
          .bind(input.slug, locale, translation.name, translation.description),
      );
    }
    return list;
  }

  return {
    list,
    get,
    async create(input: CategoryInput): Promise<CategoryView> {
      const normalized = normalizeInput(input);
      const now = Date.now();
      await db.batch(statements(normalized, null, now));
      return (await get(normalized.slug, { allowArchived: true }))!;
    },
    async update(originalSlug: string, input: CategoryInput): Promise<CategoryView> {
      const normalized = normalizeInput(input);
      const existing = await get(originalSlug, { allowArchived: true });
      if (!existing) throw new Error("CATEGORY_NOT_FOUND");
      await db.batch(statements(normalized, originalSlug, Date.now()));
      return (await get(normalized.slug, { allowArchived: true }))!;
    },
    async requireActive(slug: string): Promise<CategoryView> {
      try {
        const category = await get(slug);
        if (category) return category;
      } catch (error) {
        if (!isMissingCategorySchemaError(error)) throw error;
      }
      const fallback = POST_CATEGORIES.find((category) => category.slug === slug);
      if (!fallback) throw new Error("CATEGORY_NOT_FOUND");
      return fallbackCategory(fallback);
    },
  };
}
