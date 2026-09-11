import { Link } from "react-router";
import { getPostCategory, type PostCategorySlug } from "../../../shared/posts/categories";
import { Badge } from "../ui";
import "./post-category-badge.css";

type PostCategoryBadgeProps =
  | { categorySlug: PostCategorySlug; slug?: never; linked?: boolean }
  | { categorySlug?: never; slug: PostCategorySlug; linked?: boolean };

export function PostCategoryBadge({
  categorySlug,
  slug,
  linked = true,
}: PostCategoryBadgeProps) {
  const category = getPostCategory(categorySlug ?? slug);
  const badge = <Badge>{category.label}</Badge>;

  if (!linked) {
    return <span className="product-post-category-badge">{badge}</span>;
  }

  return (
    <Link
      to={`/category/${category.slug}`}
      className="product-post-category-badge"
      aria-label={`Browse ${category.label} posts`}
    >
      {badge}
    </Link>
  );
}
