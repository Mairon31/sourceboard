import { Form, Link, redirect, useLoaderData } from "react-router";
import {
  findPostCategory,
  POST_CATEGORIES,
  type PostCategory,
} from "../../shared/posts/categories";
import {
  createCategoryService,
  isMissingCategorySchemaError,
} from "../../worker/categories/service";
import { readSourceBoardRequestContext } from "../../shared/router-context";
import type { ServerLoaderArgs } from "../data/server-request";
import { ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";

export async function loader({ request, context }: ServerLoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  let categories: PostCategory[] = [...POST_CATEGORIES];
  const db = readSourceBoardRequestContext(context)?.env.DB;
  if (db) {
    try {
      categories = (await createCategoryService(db).list()).map((category) => ({
        slug: category.slug,
        label: category.name,
        description: category.description,
        aliases: category.aliases,
        isNsfw: category.isNsfw,
        isArchived: category.isArchived,
        noindex: category.noindex,
      }));
    } catch (error) {
      if (!isMissingCategorySchemaError(error)) throw error;
    }
  }
  const normalizedQuery = query.normalize("NFKC").toLowerCase();
  const category =
    (query ? findPostCategory(query) : null) ??
    categories.find((candidate) =>
      [candidate.slug, candidate.label, ...candidate.aliases].some(
        (value) => value.normalize("NFKC").toLowerCase() === normalizedQuery,
      ),
    ) ??
    null;

  if (category) {
    return redirect(`/category/${category.slug}`);
  }

  return { query, categories };
}

export default function CategoryIndexRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <ProductShell wide>
      <section className="product-home-compact-lead">
        <div className="product-home-compact-lead__copy">
          <span className="product-eyebrow">Categories</span>
          <h1>Browse source requests by category</h1>
          <p>Search by category name or alias, or choose one of the canonical categories below.</p>
        </div>
      </section>

      <Card className="product-form-card">
        <Form method="get" role="search" className="product-form-grid">
          <label className="product-field-native">
            <span>Category</span>
            <input
              name="q"
              type="search"
              defaultValue={data.query}
              placeholder="Anime, manga, games…"
            />
          </label>
          <button className="sb-button sb-button--primary" type="submit">
            Find category
          </button>
        </Form>
        {data.query ? (
          <div className="product-empty-state product-empty-state--compact" role="status">
            <strong>Category not found</strong>
            <p>No canonical category matches “{data.query}”. Choose one from the list below.</p>
          </div>
        ) : null}
      </Card>

      <section className="product-feed-workspace" aria-labelledby="category-list-heading">
        <div className="product-feed-workspace__heading">
          <div>
            <span className="product-eyebrow">All categories</span>
            <h2 id="category-list-heading">Choose a category</h2>
          </div>
        </div>
        <div className="product-category-directory">
          {data.categories.map((category) => (
            <Link
              key={category.slug}
              to={`/category/${category.slug}`}
              className="product-list-row"
            >
              <div>
                <strong>{category.label}</strong>
                <p>{category.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </ProductShell>
  );
}
