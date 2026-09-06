import { useLoaderData } from "react-router";
import { fixtureUiDataAdapter } from "../data/ui-adapter";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { Avatar, Badge, Button } from "../components/ui";

export async function loader() {
  return { friends: await fixtureUiDataAdapter.getFriends() };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

const relationshipLabel = {
  FRIEND: "Friends",
  INCOMING: "Incoming request",
  OUTGOING: "Request sent",
  BLOCKED: "Blocked",
} as const;

export default function FriendsRoute() {
  const { friends } = useLoaderData<LoaderData>();

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Social"
        title="Friends"
        description="Manage friend relationships used by friends-only publication visibility."
      />
      <PresentationNotice>Friend requests are fixture-backed and do not persist yet.</PresentationNotice>
      <div className="product-list">
        {friends.map((friend) => (
          <article key={friend.user.id} className="product-list-row">
            <div className="product-list-row__identity">
              <Avatar name={friend.user.displayName} src={friend.user.avatarUrl} />
              <div className="product-list-row__copy">
                <strong>{friend.user.displayName}</strong>
                <span>@{friend.user.username}{friend.mutualFriends ? ` · ${friend.mutualFriends} mutual` : ""}</span>
              </div>
            </div>
            <div className="product-chip-row">
              <Badge tone={friend.relationship === "BLOCKED" ? "warning" : friend.relationship === "FRIEND" ? "success" : "neutral"}>
                {relationshipLabel[friend.relationship]}
              </Badge>
              {friend.relationship === "INCOMING" ? <Button size="sm">Accept</Button> : null}
              {friend.relationship === "FRIEND" ? <Button size="sm" variant="ghost">Message</Button> : null}
            </div>
          </article>
        ))}
      </div>
    </ProductShell>
  );
}
