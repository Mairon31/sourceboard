import { readFileSync, writeFileSync } from "node:fs";

function finalizeSessionThrottling() {
  const path = "worker/auth/service.ts";
  let text = readFileSync(path, "utf8");
  const marker = "export function createAuthService(dependencies: AuthServiceDependencies): AuthService {";

  if (!text.includes("const SESSION_TOUCH_INTERVAL_MS")) {
    if (!text.includes(marker)) throw new Error("createAuthService marker missing");
    text = text.replace(marker, `const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;\n\n${marker}`);
  }

  const currentStart = text.indexOf("  async function currentSession(");
  const currentEnd = text.indexOf("  async function prepareLogin(", currentStart);
  if (currentStart < 0 || currentEnd < 0) throw new Error("currentSession block missing");
  let currentBlock = text.slice(currentStart, currentEnd);

  const currentLookup = `    const current = await dependencies.store.findActiveSessionByTokenHash(\n      hashOpaqueToken(rawToken),\n      now(),\n    );`;
  const throttledCurrentLookup = `    const at = now();\n    const current = await dependencies.store.findActiveSessionByTokenHash(\n      hashOpaqueToken(rawToken),\n      at,\n    );`;
  if (!currentBlock.includes("const at = now();")) {
    if (!currentBlock.includes(currentLookup)) throw new Error("currentSession lookup shape changed");
    currentBlock = currentBlock.replace(currentLookup, throttledCurrentLookup);
  }

  const currentTouch = "    await dependencies.store.touchSession(current.id, now());";
  const throttledTouch = `    if (at - current.lastUsedAt >= SESSION_TOUCH_INTERVAL_MS) {\n      await dependencies.store.touchSession(current.id, at);\n    }`;
  if (!currentBlock.includes("SESSION_TOUCH_INTERVAL_MS")) {
    if (!currentBlock.includes(currentTouch)) throw new Error("currentSession touch shape changed");
    currentBlock = currentBlock.replace(currentTouch, throttledTouch);
  }
  text = text.slice(0, currentStart) + currentBlock + text.slice(currentEnd);

  const getStart = text.indexOf("  async function getSession(");
  const getEnd = text.indexOf("  async function logout(", getStart);
  if (getStart < 0 || getEnd < 0) throw new Error("getSession block missing");
  let getBlock = text.slice(getStart, getEnd);
  const getTouch = "    await dependencies.store.touchSession(current.id, at);";
  if (!getBlock.includes("SESSION_TOUCH_INTERVAL_MS")) {
    if (!getBlock.includes(getTouch)) throw new Error("getSession touch shape changed");
    getBlock = getBlock.replace(getTouch, throttledTouch);
  }
  text = text.slice(0, getStart) + getBlock + text.slice(getEnd);

  const matches = text.match(/at - current\.lastUsedAt >= SESSION_TOUCH_INTERVAL_MS/g) ?? [];
  if (matches.length !== 2) {
    throw new Error(`expected 2 throttled session paths, found ${matches.length}`);
  }
  writeFileSync(path, text);
}

function finalizePostDetailConcurrency() {
  const path = "app/routes/post-detail.tsx";
  let text = readFileSync(path, "utf8");
  if (text.includes("const [post, commentsResult] = await Promise.all")) return;

  const oldBlock = `      const post = await service.getPost(params.postId ?? "", userId);\n      const comments = post\n        ? await createCommentService({\n            store: createD1CommentStore(runtime.db),\n            postStore: createD1PostStore(runtime.db),\n            profileStore: createD1ProfileStore(runtime.db),\n          }).listForPost(post.id, userId, null, 50)\n        : { comments: [], nextCursor: null };\n      return {\n        post: post ? { ...post, comments: comments.comments } : post,`;
  const newBlock = `      const commentService = createCommentService({\n        store: createD1CommentStore(runtime.db),\n        postStore: createD1PostStore(runtime.db),\n        profileStore: createD1ProfileStore(runtime.db),\n      });\n      const postId = params.postId ?? "";\n      const commentsPromise = commentService.listForPost(postId, userId, null, 50).then(\n        (value) => ({ ok: true as const, value }),\n        (error: unknown) => ({ ok: false as const, error }),\n      );\n      const [post, commentsResult] = await Promise.all([\n        service.getPost(postId, userId),\n        commentsPromise,\n      ]);\n      if (post && !commentsResult.ok) throw commentsResult.error;\n      const comments = commentsResult.ok ? commentsResult.value : { comments: [], nextCursor: null };\n      return {\n        post: post ? { ...post, comments: comments.comments } : post,`;

  if (!text.includes(oldBlock)) throw new Error("post detail sequential block shape changed");
  text = text.replace(oldBlock, newBlock);
  writeFileSync(path, text);
}

finalizeSessionThrottling();
finalizePostDetailConcurrency();
