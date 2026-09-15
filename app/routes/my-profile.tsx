import { useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { createReputationReader } from "../../worker/reputation/read";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { ProfileAccountActions } from "../components/product/ProfileAccountActions";
import { ProfileEditor } from "../components/product/ProfileEditor";
import { ProductShell } from "../components/product/ProductShell";
import { loadAdminAccess } from "../data/admin-access";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  const [profileResult, adminAccess] = await Promise.all([
    withServerSession(
      request,
      context,
      (unavailable) => ({
        authenticated: false as const,
        unavailable,
        profile: null,
      }),
      async (runtime, userId) => {
        const profileService = createProfileService({
          store: createD1ProfileStore(runtime.db),
          reputation: createReputationReader(runtime.db),
        });
        const mine = await profileService.getMyProfile(userId);
        const profile = await profileService.getPublicProfile(mine.profile.username, userId);
        return {
          authenticated: true as const,
          unavailable: false,
          profile,
        };
      },
    ),
    loadAdminAccess(request, context),
  ]);
  return { ...profileResult, canAccessAdmin: adminAccess.authorized };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function MyProfileRoute() {
  const data = useLoaderData<LoaderData>();

  if (!data.authenticated || !data.profile) {
    return (
      <ProductShell wide>
        <AuthRequiredCard unavailable={data.unavailable} />
      </ProductShell>
    );
  }

  return (
    <ProductShell wide>
      <ProfileEditor profile={data.profile} />
      <div className="product-profile-secondary">
        <ProfileAccountActions canAccessAdmin={data.canAccessAdmin} />
      </div>
    </ProductShell>
  );
}
