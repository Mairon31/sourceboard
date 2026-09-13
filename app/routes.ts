import { index, route, type RouteConfig } from "@react-router/dev/routes";
import { SUPPORTED_LOCALES } from "../shared/i18n/locales";

const localizedOfficialRoutes = SUPPORTED_LOCALES.flatMap((locale) => [
  route(locale, "routes/_index.tsx", { id: `localized-home-${locale}` }),
  route(`${locale}/store`, "routes/store.tsx", { id: `localized-store-${locale}` }),
  route(`${locale}/category`, "routes/category-index.tsx", { id: `localized-category-${locale}` }),
  route(`${locale}/category/:categorySlug`, "routes/category.tsx", {
    id: `localized-category-detail-${locale}`,
  }),
  route(`${locale}/docs`, "routes/docs.tsx", { id: `localized-docs-${locale}` }),
  route(`${locale}/docs/:slug`, "routes/docs-article.tsx", {
    id: `localized-docs-article-${locale}`,
  }),
  route(`${locale}/legal`, "routes/legal.tsx", { id: `localized-legal-${locale}` }),
  route(`${locale}/legal/:slug`, "routes/legal-article.tsx", {
    id: `localized-legal-article-${locale}`,
  }),
  route(`${locale}/pages/:slug`, "routes/page-article.tsx", {
    id: `localized-cms-page-${locale}`,
  }),
]);

export default [
  index("routes/_index.tsx"),
  ...localizedOfficialRoutes,
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("verify-email", "routes/verify-email.tsx"),
  route("search", "routes/search.tsx"),
  route("category", "routes/category-index.tsx"),
  route("category/:categorySlug", "routes/category.tsx"),
  route("resources/feed/:kind", "routes/feed-resource.tsx"),
  route("resources/locale", "routes/locale-preference.tsx"),
  route("post/new", "routes/post-new.tsx"),
  route("posts/:postId", "routes/post-detail.tsx"),
  route("posts/:postId/:slug", "routes/post-detail.tsx", { id: "post-detail-slug" }),
  route("sh/:shortId", "routes/share-resolver.tsx"),
  route("u/:username", "routes/profile.tsx", { id: "user-profile" }),
  route("profile/:username", "routes/profile.tsx", { id: "legacy-profile" }),
  route("friends", "routes/friends.tsx"),
  route("notifications", "routes/notifications.tsx"),
  route("store", "routes/store.tsx"),
  route("store/create", "routes/store-create.tsx"),
  route("settings", "routes/settings.tsx"),
  route("docs", "routes/docs.tsx"),
  route("docs/:slug", "routes/docs-article.tsx"),
  route("legal", "routes/legal.tsx"),
  route("legal/:slug", "routes/legal-article.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/moderation", "routes/admin-moderation.tsx"),
  route("admin/source-integrity", "routes/admin-verifications.tsx", {
    id: "admin-source-integrity",
  }),
  route("admin/verifications", "routes/admin-verifications.tsx", {
    id: "admin-verifications-legacy",
  }),
  route("admin/users", "routes/admin-users.tsx"),
  route("admin/roles", "routes/admin-roles.tsx"),
  route("admin/reputation", "routes/admin-reputation.tsx"),
  route("admin/store", "routes/admin-store.tsx"),
  route("admin/content", "routes/admin-content.tsx"),
  route("admin/content/:pageId", "routes/admin-content-page.tsx"),
  route("admin/audit", "routes/admin-audit.tsx"),
  route("admin/anonymous/:postId", "routes/admin-anonymous.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
