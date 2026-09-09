from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"anchor is not unique in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Profile API: share the existing session/CSRF envelope and add username status + mutation.
replace_once(
    "worker/profile/api-core.ts",
    'import { createProfileService } from "./service";\n',
    'import { createProfileService } from "./service";\nimport { createD1UsernamePolicyStore, createUsernamePolicyService } from "./username-policy";\n',
)
replace_once(
    "worker/profile/api-core.ts",
    'const preferencesSchema = z.object({\n  hideNsfw: z.boolean(),\n  blurNsfw: z.boolean(),\n  allowNsfwDirectOverride: z.boolean(),\n  allowFriendRequests: z.boolean(),\n  notifyActivity: z.boolean().default(true),\n  notifyFriendships: z.boolean().default(true),\n});\n',
    'const preferencesSchema = z.object({\n  hideNsfw: z.boolean(),\n  blurNsfw: z.boolean(),\n  allowNsfwDirectOverride: z.boolean(),\n  allowFriendRequests: z.boolean(),\n  notifyActivity: z.boolean().default(true),\n  notifyFriendships: z.boolean().default(true),\n});\n\nconst usernameChangeSchema = z.object({ username: z.string() });\n',
)
replace_once(
    "worker/profile/api-core.ts",
    'async function handlePreferencesPatch(ctx: ProfileRouteContext): Promise<Response> {\n  requireSameOriginAndCsrf(ctx.request);\n  const viewerId = await requireViewerId(ctx.request, ctx.env);\n  const input = parseSchema(preferencesSchema, await parseJson(ctx.request));\n  return jsonResponse(\n    { preferences: await ctx.service.updateMyPreferences(viewerId, input) },\n    ctx.requestId,\n  );\n}\n',
    'async function handlePreferencesPatch(ctx: ProfileRouteContext): Promise<Response> {\n  requireSameOriginAndCsrf(ctx.request);\n  const viewerId = await requireViewerId(ctx.request, ctx.env);\n  const input = parseSchema(preferencesSchema, await parseJson(ctx.request));\n  return jsonResponse(\n    { preferences: await ctx.service.updateMyPreferences(viewerId, input) },\n    ctx.requestId,\n  );\n}\n\nfunction usernamePolicyService(env: SourceBoardEnvironment) {\n  return createUsernamePolicyService({ store: createD1UsernamePolicyStore(requireDatabase(env)) });\n}\n\nasync function handleUsernameGet(ctx: ProfileRouteContext): Promise<Response> {\n  const viewerId = await requireViewerId(ctx.request, ctx.env);\n  return jsonResponse(\n    { username: await usernamePolicyService(ctx.env).getStatus(viewerId) },\n    ctx.requestId,\n  );\n}\n\nasync function handleUsernamePatch(ctx: ProfileRouteContext): Promise<Response> {\n  requireSameOriginAndCsrf(ctx.request);\n  const viewerId = await requireViewerId(ctx.request, ctx.env);\n  const input = parseSchema(usernameChangeSchema, await parseJson(ctx.request));\n  const security = getRequestSecurityContext(ctx.request);\n  return jsonResponse(\n    {\n      username: await usernamePolicyService(ctx.env).changeUsername(viewerId, input.username, {\n        requestId: ctx.requestId,\n        ipPrefixHash: security.ipPrefixHash,\n      }),\n    },\n    ctx.requestId,\n  );\n}\n',
)
replace_once(
    "worker/profile/api-core.ts",
    '    "PATCH /api/profile/me/preferences": () => handlePreferencesPatch(ctx),\n',
    '    "PATCH /api/profile/me/preferences": () => handlePreferencesPatch(ctx),\n    "GET /api/profile/me/username": () => handleUsernameGet(ctx),\n    "PATCH /api/profile/me/username": () => handleUsernamePatch(ctx),\n',
)

# Settings: load quota server-side and expose a compact account-control panel.
replace_once(
    "app/routes/settings.tsx",
    'import { createProfileService } from "../../worker/profile/service";\n',
    'import { createProfileService } from "../../worker/profile/service";\nimport { createD1UsernamePolicyStore, createUsernamePolicyService } from "../../worker/profile/username-policy";\n',
)
replace_once(
    "app/routes/settings.tsx",
    '    (unavailable) => ({ authenticated: false, unavailable, preferences: null }),\n    async (runtime, userId) => {\n      const preferences = (\n        await createProfileService({ store: createD1ProfileStore(runtime.db) }).getMyProfile(userId)\n      ).preferences;\n      return { authenticated: true, unavailable: false, preferences };\n    },\n',
    '    (unavailable) => ({ authenticated: false, unavailable, preferences: null, username: null }),\n    async (runtime, userId) => {\n      const [profile, username] = await Promise.all([\n        createProfileService({ store: createD1ProfileStore(runtime.db) }).getMyProfile(userId),\n        createUsernamePolicyService({ store: createD1UsernamePolicyStore(runtime.db) }).getStatus(userId),\n      ]);\n      return { authenticated: true, unavailable: false, preferences: profile.preferences, username };\n    },\n',
)
account_anchor = '''function PasswordPanel({ authenticated }: { authenticated: boolean }) {\n'''
username_panel = '''function formatUsernameAvailability(value: number | null): string {\n  if (!value) return "Available now";\n  return new Intl.DateTimeFormat("en-US", {\n    dateStyle: "medium",\n    timeStyle: "short",\n    timeZone: "UTC",\n  }).format(new Date(value));\n}\n\nfunction UsernamePanel({ data }: { data: SettingsData }) {\n  const initial = data.username;\n  const [value, setValue] = useState(initial?.username ?? "");\n  const [quota, setQuota] = useState(initial);\n  const [busy, setBusy] = useState(false);\n  const [status, setStatus] = useState<string | null>(null);\n\n  useEffect(() => {\n    setValue(data.username?.username ?? "");\n    setQuota(data.username);\n  }, [data.username]);\n\n  async function changeUsername() {\n    if (!data.authenticated || !quota?.canChange || busy) return;\n    setBusy(true);\n    setStatus(null);\n    try {\n      const response = await fetch("/api/profile/me/username", {\n        method: "PATCH",\n        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },\n        body: JSON.stringify({ username: value }),\n      });\n      const payload = (await response.json().catch(() => null)) as\n        | { username?: NonNullable<SettingsData["username"]>; error?: { message?: string } }\n        | null;\n      if (!response.ok || !payload?.username) {\n        setStatus(payload?.error?.message ?? "The username could not be changed.");\n        return;\n      }\n      setQuota(payload.username);\n      setValue(payload.username.username);\n      setStatus("Username updated.");\n    } catch {\n      setStatus("The username could not be changed. Check your connection and try again.");\n    } finally {\n      setBusy(false);\n    }\n  }\n\n  return (\n    <Card className="product-settings-section">\n      <div className="product-settings-control-block">\n        <strong>Username</strong>\n        <span>\n          Usernames are unique. You can change yours up to 3 times in a rolling 15-day window,\n          with at least 24 hours between changes.\n        </span>\n        <Input\n          label="Username"\n          value={value}\n          minLength={3}\n          maxLength={32}\n          disabled={!data.authenticated || busy}\n          onChange={(event) => setValue(event.target.value)}\n        />\n        {quota ? (\n          <div className="product-settings-inline-actions">\n            <span>\n              {quota.remainingChanges} of {quota.maxChanges} changes available\n            </span>\n            <span>Next change: {formatUsernameAvailability(quota.nextChangeAt)}</span>\n          </div>\n        ) : null}\n        <div className="product-settings-inline-actions">\n          <Button\n            size="sm"\n            loading={busy}\n            disabled={!data.authenticated || !quota?.canChange || value.trim() === quota.username}\n            onClick={() => void changeUsername()}\n          >\n            Change username\n          </Button>\n          {status ? <span role="status">{status}</span> : null}\n        </div>\n      </div>\n    </Card>\n  );\n}\n\n'''
replace_once("app/routes/settings.tsx", account_anchor, username_panel + account_anchor)
replace_once(
    "app/routes/settings.tsx",
    '            <PasswordPanel authenticated={data.authenticated} />\n',
    '            <UsernamePanel data={data} />\n            <PasswordPanel authenticated={data.authenticated} />\n',
)
