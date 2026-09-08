import { useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { PostComposer } from "../components/product/PostComposer";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ authenticated: false, unavailable, identity: null }),
    async (runtime, userId) => {
      if (!userId) return { authenticated: false, unavailable: false, identity: null };
      const profileStore = createD1ProfileStore(runtime.db);
      const now = Date.now();
      const [profile, cosmetics] = await Promise.all([
        profileStore.getProfileByUserId(userId, now),
        profileStore.getEquippedCosmetics(userId),
      ]);
      return {
        authenticated: true,
        unavailable: false,
        identity: profile
          ? {
              displayName: profile.displayName,
              avatarUrl: profile.avatarAssetId
                ? `/api/media/profile/${encodeURIComponent(profile.avatarAssetId)}`
                : undefined,
              cosmetics,
            }
          : {
              displayName: "SourceBoard member",
              avatarUrl: undefined,
              cosmetics,
            },
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function NewPostRoute() {
  const { authenticated, unavailable, identity } = useLoaderData<LoaderData>();

  return (
    <ProductShell>
      <PageHeader
        eyebrow="New request"
        title="Create a source request"
        description="Give the community one clear image and enough context to trace where it originally came from."
      />

      {!authenticated ? (
        <AuthRequiredCard
          unavailable={unavailable}
          title="Sign in to publish a source request"
          description="Publishing requires a verified SourceBoard account so your request and privacy choices stay attached to you."
        />
      ) : null}

      {authenticated ? <PostComposer identity={identity} unavailable={unavailable} /> : null}
    </ProductShell>
  );
}
