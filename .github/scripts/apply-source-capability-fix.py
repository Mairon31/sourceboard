from pathlib import Path

path = Path("worker/source/api.ts")
text = path.read_text()

text = text.replace(
    'import { hasCapability } from "../auth/rbac";',
    'import { hasCapability } from "../auth/rbac";',
)
text = text.replace(
    '  capability?: "source.verify",\n)',
    '  capability?: "source.verify" | "source.revoke_verification",\n)',
)
text = text.replace(
    '    throw new PostError(403, "CAPABILITY_REQUIRED", "You are not allowed to verify sources.");',
    '    throw new PostError(\n      403,\n      "CAPABILITY_REQUIRED",\n      "You are not allowed to manage source verification.",\n    );',
)
text = text.replace(
    'function action(pathname: string): string | null {\n  return (\n    pathname.match(/^\\/api\\/posts\\/[^/]+\\/source\\/(accept|revoke|verify|unverify)$/)?.[1] ?? null\n  );\n}',
    'type SourceAction = "accept" | "revoke" | "verify" | "unverify";\n\nfunction action(pathname: string): SourceAction | null {\n  const matched =\n    pathname.match(/^\\/api\\/posts\\/[^/]+\\/source\\/(accept|revoke|verify|unverify)$/)?.[1] ?? null;\n  return matched as SourceAction | null;\n}\n\nexport function requiredSourceCapability(\n  kind: SourceAction,\n): "source.verify" | "source.revoke_verification" | undefined {\n  if (kind === "verify") return "source.verify";\n  if (kind === "unverify") return "source.revoke_verification";\n  return undefined;\n}',
)
text = text.replace(
    '    const needsVerification = kind === "verify" || kind === "unverify";\n    const current = await actor(\n      request,\n      requestId,\n      env,\n      needsVerification ? "source.verify" : undefined,\n    );\n    if (!needsVerification && current.id !== target.post_author_id)',
    '    const capability = requiredSourceCapability(kind);\n    const current = await actor(request, requestId, env, capability);\n    if (!capability && current.id !== target.post_author_id)',
)

path.write_text(text)
