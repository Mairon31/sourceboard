import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { createReputationReader } from "../../worker/reputation/read";
import type { RootLoaderData } from "../root";
import { loadAdminAccess } from "../data/admin-access";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProfileAccountActions } from "../components/product/ProfileAccountActions";
import { ProfileEditor } from "../components/product/ProfileEditor";
import { ProfileHero } from "../components/product/ProfileHero";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Badge, Card } from "../components/ui";

interface LoaderArgs extends ServerLoaderArgs {
  params: { username?: string };
}

export async function loader({ params, request, context }: LoaderArgs) {
  const [profileResult, adminAccess] = await Promise.all([
    withServerSession(
      request,
      context,
      (unavailable) => ({ profile: null, unavailable }),
      async (runtime, userId) => ({
        profile: await createProfileService({
          store: createD1ProfileStore(runtime.db),
          reputation: createReputationReader(runtime.db),
        }).getPublicProfile(params.username ?? "", userId),
        unavailable: false,
      }),
    ),
    loadAdminAccess(request, context),
  ]);
  return { ...profileResult, canAccessAdmin: adminAccess.authorized };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type PublicProfile = NonNullable<LoaderData["profile"]>;

function UnavailableProfile({ unavailable }: { unavailable: boolean }) {
  return (
    <ProductShell wide>
      <Card className="product-empty-state">
        <PageHeader
          eyebrow="Profile"
          title="Profile unavailable"
          description={
            unavailable
              ? "The profile service is not available in this environment yet."
              : "This profile is private, blocked or does not exist."
          }
        />
        <p>Public profile data is shown only after server-side privacy checks succeed.</p>
      </Card>
    </ProductShell>
  );
}

function ContributionHistory({ profile }: { profile: PublicProfile }) {
  return (
    <>
      <PageHeader
        eyebrow="Contribution history"
        title="Reputation is earned in SourceBoard"
        description="Contribution points and achievements are calculated from the server-side ledger."
      />
      <Card className="product-empty-state">
        <p>
          Verified source rewards and achievement history are server-authoritative and append-only.
        </p>
        {profile.achievements?.length ? (
          <div className="product-chip-row" aria-label="Earned achievements">
            {profile.achievements.map((achievement) => (
              <Badge key={achievement.id} tone="neutral">
                {achievement.icon} {achievement.name}
              </Badge>
            ))}
          </div>
        ) : null}
        <Link className="product-text-action" to="/">
          Return to feed
        </Link>
      </Card>
    </>
  );
}

export default function ProfileRoute() {
  const { profile, unavailable, canAccessAdmin } = useLoaderData<LoaderData>();
  const rootData = useRouteLoaderData<RootLoaderData>("root");
  const isOwnProfile = Boolean(profile && rootData?.session?.user.id === profile.id);
  if (!profile) return <UnavailableProfile unavailable={unavailable} />;
  return (
    <ProductShell wide>
      <ProfileHero profile={profile} isOwnProfile={isOwnProfile} />
      {isOwnProfile ? <ProfileEditor /> : null}
      <ContributionHistory profile={profile} />
      {isOwnProfile ? <ProfileAccountActions canAccessAdmin={canAccessAdmin} /> : null}
    </ProductShell>
  );
}
