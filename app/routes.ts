import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("verify-email", "routes/verify-email.tsx"),
  route("post/new", "routes/post-new.tsx"),
  route("posts/:postId", "routes/post-detail.tsx"),
  route("profile/:username", "routes/profile.tsx"),
  route("friends", "routes/friends.tsx"),
  route("notifications", "routes/notifications.tsx"),
  route("store", "routes/store.tsx"),
  route("settings", "routes/settings.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/moderation", "routes/admin-moderation.tsx"),
  route("admin/anonymous/:postId", "routes/admin-anonymous.tsx"),
] satisfies RouteConfig;
