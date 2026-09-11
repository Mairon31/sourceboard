import { Link } from "react-router";
import { getPostCategory, type PostCategorySlug } from "../../../shared/posts/categories";
import { Badge } from "../ui";

export function PostCategoryBadge({ slug }: { slug: PostCategorySlug }) {
  const category = getPostCategory(slug);

  return (
    <Link
      to={`/category/${category.slug}`}
      className="product-post-category-badge"
      aria-label={`Browse ${category.label} posts`}
    >
      <Badge>{category.label}</Badge>
    </Link>
  );
}
