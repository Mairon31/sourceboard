import { useLoaderData, type MetaFunction } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { FriendsWorkspace } from "../components/product/FriendsWorkspace";
import { ProductShell } from "../components/product/ProductShell";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withServerSession(
    request,
    context,
    (unavailable) => ({ authenticated: false, unavailable, friends: [] }),
    async (runtime, userId) => {
      const result = await createProfileService({
        store: createD1ProfileStore(runtime.db),
      }).listFriends(userId);
      return { authenticated: true, unavailable: false, friends: result.friends };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const meta: MetaFunction = () => [
  { title: "Friends · SourceBoard" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function FriendsRoute() {
  const data = useLoaderData<LoaderData>();
  return (
    <ProductShell>
      <header className="product-friends-lead">
        <span className="product-eyebrow">Social</span>
        <div>
          <h1>Friends</h1>
          <p>Connections, requests and account discovery in one place.</p>
        </div>
      </header>
      {data.authenticated ? (
        <FriendsWorkspace initialFriends={data.friends} />
      ) : data.unavailable ? (
        <AuthRequiredCard unavailable />
      ) : (
        <AuthRequiredCard
          title="Sign in to manage friends"
          description="Friend requests and blocks are private account data. Sign in or create an account to manage your connections."
        />
      )}
    </ProductShell>
  );
}
