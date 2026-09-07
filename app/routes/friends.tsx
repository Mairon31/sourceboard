import { useState } from "react";
import { useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { SocialActionButton } from "../components/product/SocialActionButton";
import { Avatar, Badge, Card } from "../components/ui";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withServerSession(
    request,
    context,
    (unavailable) => ({ authenticated: false, unavailable, friends: [] }),
    async (runtime, userId) => {
      const friends = await createProfileService({
        store: createD1ProfileStore(runtime.db),
      }).listFriends(userId);
      return { authenticated: true, unavailable: false, friends: friends.friends };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type Friend = LoaderData["friends"][number];

const relationshipLabel = {
  FRIEND: "Friends",
  INCOMING: "Incoming request",
  OUTGOING: "Request sent",
  BLOCKED: "Blocked",
  NONE: "Not connected",
} as const;

function IncomingFriendActions({
  friend,
  onChanged,
}: {
  friend: Friend;
  onChanged: (friend: Friend) => void;
}) {
  return (
    <>
      <SocialActionButton
        endpoint={`/api/friends/${friend.id}/accept`}
        method="POST"
        onSuccess={() => onChanged({ ...friend, relationship: "FRIEND" })}
      >
        Accept
      </SocialActionButton>
      <SocialActionButton
        endpoint={`/api/friends/${friend.id}/decline`}
        method="POST"
        onSuccess={() => onChanged({ ...friend, relationship: "NONE" })}
      >
        Decline
      </SocialActionButton>
    </>
  );
}

const friendshipActions = {
  OUTGOING: { endpoint: "cancel", method: "POST", label: "Cancel", next: "NONE" },
  FRIEND: { endpoint: "", method: "DELETE", label: "Remove", next: "NONE" },
} as const;

function BlockedFriendAction({
  friend,
  onChanged,
}: {
  friend: Friend;
  onChanged: (friend: Friend) => void;
}) {
  return (
    <SocialActionButton
      endpoint={`/api/users/${friend.id}/block`}
      method="DELETE"
      onSuccess={() => onChanged({ ...friend, relationship: "NONE" })}
    >
      Unblock
    </SocialActionButton>
  );
}

function SingleFriendAction({
  friend,
  onChanged,
}: {
  friend: Friend;
  onChanged: (friend: Friend) => void;
}) {
  if (!friend.friendshipId || !(friend.relationship in friendshipActions)) return null;
  const action = friendshipActions[friend.relationship as keyof typeof friendshipActions];
  return (
    <SocialActionButton
      endpoint={`/api/friends/${friend.id}${action.endpoint ? `/${action.endpoint}` : ""}`}
      method={action.method}
      onSuccess={() => onChanged({ ...friend, relationship: action.next })}
    >
      {action.label}
    </SocialActionButton>
  );
}

function FriendActions({
  friend,
  onChanged,
}: {
  friend: Friend;
  onChanged: (friend: Friend) => void;
}) {
  if (friend.relationship === "BLOCKED") {
    return <BlockedFriendAction friend={friend} onChanged={onChanged} />;
  }
  if (friend.relationship === "INCOMING" && friend.friendshipId) {
    return <IncomingFriendActions friend={friend} onChanged={onChanged} />;
  }
  return <SingleFriendAction friend={friend} onChanged={onChanged} />;
}

function FriendStatusBadge({ friend }: { friend: Friend }) {
  const tone =
    friend.relationship === "BLOCKED"
      ? "warning"
      : friend.relationship === "FRIEND"
        ? "success"
        : "neutral";
  return <Badge tone={tone}>{relationshipLabel[friend.relationship]}</Badge>;
}

function FriendList({
  friends,
  onChanged,
}: {
  friends: Friend[];
  onChanged: (friend: Friend) => void;
}) {
  return (
    <div className="product-list">
      {friends.map((friend) => (
        <article key={friend.id} className="product-list-row">
          <div className="product-list-row__identity">
            <Avatar name={friend.displayName} src={friend.avatarUrl} />
            <div className="product-list-row__copy">
              <strong>{friend.displayName}</strong>
              <span>@{friend.username}</span>
            </div>
          </div>
          <div className="product-chip-row">
            <FriendStatusBadge friend={friend} />
            <FriendActions friend={friend} onChanged={onChanged} />
          </div>
        </article>
      ))}
    </div>
  );
}

function FriendsContent({
  data,
  friends,
  onChanged,
}: {
  data: LoaderData;
  friends: Friend[];
  onChanged: (friend: Friend) => void;
}) {
  if (!data.authenticated) {
    return data.unavailable ? (
      <AuthRequiredCard unavailable />
    ) : (
      <AuthRequiredCard
        title="Sign in to manage friends"
        description="Friend requests and blocks are private account data. Sign in or create an account to manage your connections."
      />
    );
  }
  if (friends.length === 0) {
    return (
      <Card className="product-empty-state">
        <h2>No social connections yet</h2>
        <p>Friend requests, accepted friends and blocks will appear here.</p>
      </Card>
    );
  }
  return <FriendList friends={friends} onChanged={onChanged} />;
}

export default function FriendsRoute() {
  const data = useLoaderData<LoaderData>();
  const [friends, setFriends] = useState(data.friends);
  const updateFriend = (next: Friend) =>
    setFriends((current) => current.map((item) => (item.id === next.id ? next : item)));

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Social"
        title="Friends"
        description="Manage friend relationships used by friends-only publication visibility."
      />
      <FriendsContent data={data} friends={friends} onChanged={updateFriend} />
    </ProductShell>
  );
}
