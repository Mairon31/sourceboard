import { useLoaderData, type MetaFunction } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { FriendsWorkspace } from "../components/product/FriendsWorkspace";
import { ProductShell } from "../components/product/ProductShell";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { useI18n } from "../i18n/I18nProvider";

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
  const { t } = useI18n();
  const data = useLoaderData<LoaderData>();
  return (
    <ProductShell>
      <header className="product-friends-lead">
        <span className="product-eyebrow">{t("friends.eyebrow")}</span>
        <div>
          <h1>{t("friends.title")}</h1>
          <p>{t("friends.description")}</p>
        </div>
      </header>
      {data.authenticated ? (
        <FriendsWorkspace initialFriends={data.friends} />
      ) : data.unavailable ? (
        <AuthRequiredCard unavailable />
      ) : (
        <AuthRequiredCard
          title={t("friends.authTitle")}
          description={t("friends.authDescription")}
        />
      )}
    </ProductShell>
  );
}
