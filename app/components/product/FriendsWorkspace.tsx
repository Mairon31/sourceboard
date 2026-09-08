import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { FriendsListDto, Relationship } from "../../../worker/profile/types";
import { readCsrfToken } from "../../data/csrf";
import { Button, Card, Input } from "../ui";
import { ConfirmAction } from "./ConfirmAction";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { SocialActionButton } from "./SocialActionButton";

type Friend = FriendsListDto["friends"][number];
type WorkspaceMode = "friends" | "requests" | "add" | "discover";
type ConfirmedAction = "accept" | "decline" | "remove";

const relationshipLabel: Record<Relationship, string> = {
  FRIEND: "Friend",
  INCOMING: "Incoming request",
  OUTGOING: "Request sent",
  BLOCKED: "Blocked",
  NONE: "Not connected",
};

function actionEndpoint(
  friend: Friend,
  action: ConfirmedAction,
): { endpoint: string; method: "POST" | "DELETE" } {
  if (action === "remove") {
    return { endpoint: `/api/friends/${encodeURIComponent(friend.id)}`, method: "DELETE" };
  }
  return {
    endpoint: `/api/friends/${encodeURIComponent(friend.id)}/${action}`,
    method: "POST",
  };
}

async function mutateRelationship(friend: Friend, action: ConfirmedAction): Promise<void> {
  const target = actionEndpoint(friend, action);
  const response = await fetch(target.endpoint, {
    method: target.method,
    headers: { "x-csrf-token": readCsrfToken() },
  });
  if (!response.ok) {
    throw new Error("The relationship could not be updated.");
  }
}

function RelationshipConfirmAction({
  friend,
  action,
  onChanged,
}: {
  friend: Friend;
  action: ConfirmedAction;
  onChanged: (friend: Friend) => void;
}) {
  const nextRelationship: Relationship = action === "accept" ? "FRIEND" : "NONE";
  const labels = {
    accept: {
      title: "Accept friend request?",
      description: `Accept ${friend.displayName}'s friend request.`,
      trigger: "Accept",
      confirm: "Accept",
      destructive: false,
    },
    decline: {
      title: "Decline friend request?",
      description: `Decline ${friend.displayName}'s request. They can send another request later.`,
      trigger: "Decline",
      confirm: "Decline",
      destructive: true,
    },
    remove: {
      title: "Remove friend?",
      description: `Remove ${friend.displayName} from your friends. Friends-only access will end immediately.`,
      trigger: "Remove",
      confirm: "Remove friend",
      destructive: true,
    },
  } as const;
  const copy = labels[action];
  return (
    <ConfirmAction
      title={copy.title}
      description={copy.description}
      triggerLabel={copy.trigger}
      confirmLabel={copy.confirm}
      destructive={copy.destructive}
      onConfirm={async () => {
        await mutateRelationship(friend, action);
        onChanged({ ...friend, relationship: nextRelationship });
      }}
    />
  );
}

function FriendActions({
  friend,
  onChanged,
}: {
  friend: Friend;
  onChanged: (friend: Friend) => void;
}) {
  if (friend.relationship === "INCOMING") {
    return (
      <div className="product-chip-row">
        <RelationshipConfirmAction friend={friend} action="accept" onChanged={onChanged} />
        <RelationshipConfirmAction friend={friend} action="decline" onChanged={onChanged} />
      </div>
    );
  }
  if (friend.relationship === "FRIEND") {
    return <RelationshipConfirmAction friend={friend} action="remove" onChanged={onChanged} />;
  }
  if (friend.relationship === "OUTGOING") {
    return (
      <SocialActionButton
        endpoint={`/api/friends/${encodeURIComponent(friend.id)}/cancel`}
        method="POST"
        onSuccess={() => onChanged({ ...friend, relationship: "NONE" })}
      >
        Cancel request
      </SocialActionButton>
    );
  }
  if (friend.relationship === "BLOCKED") {
    return (
      <SocialActionButton
        endpoint={`/api/users/${encodeURIComponent(friend.id)}/block`}
        method="DELETE"
        onSuccess={() => onChanged({ ...friend, relationship: "NONE" })}
      >
        Unblock
      </SocialActionButton>
    );
  }
  return null;
}

function FriendRow({ friend, onChanged }: { friend: Friend; onChanged: (friend: Friend) => void }) {
  return (
    <article className="product-list-row">
      <Link className="product-list-row__identity" to={`/u/${encodeURIComponent(friend.username)}`}>
        <CosmeticIdentity
          displayName={friend.displayName}
          avatarUrl={friend.avatarUrl}
          mode="compact"
          nameAs="strong"
        />
        <span className="product-list-row__copy">
          <span>@{friend.username}</span>
          <span>{relationshipLabel[friend.relationship]}</span>
        </span>
      </Link>
      <FriendActions friend={friend} onChanged={onChanged} />
    </article>
  );
}

function FriendList({
  items,
  emptyTitle,
  emptyDescription,
  onChanged,
}: {
  items: Friend[];
  emptyTitle: string;
  emptyDescription: string;
  onChanged: (friend: Friend) => void;
}) {
  if (!items.length) {
    return (
      <Card className="product-empty-state">
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </Card>
    );
  }
  return (
    <div className="product-list">
      {items.map((friend) => (
        <FriendRow key={friend.id} friend={friend} onChanged={onChanged} />
      ))}
    </div>
  );
}

export function FriendsWorkspace({ initialFriends }: { initialFriends: Friend[] }) {
  const [mode, setMode] = useState<WorkspaceMode>("friends");
  const [connections, setConnections] = useState(initialFriends);
  const [suggestions, setSuggestions] = useState<Friend[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();

  const friends = useMemo(
    () => connections.filter((friend) => friend.relationship === "FRIEND"),
    [connections],
  );
  const requests = useMemo(
    () =>
      connections.filter(
        (friend) => friend.relationship === "INCOMING" || friend.relationship === "OUTGOING",
      ),
    [connections],
  );
  const blocked = useMemo(
    () => connections.filter((friend) => friend.relationship === "BLOCKED"),
    [connections],
  );

  function updateFriend(next: Friend) {
    setConnections((current) => {
      const found = current.some((friend) => friend.id === next.id);
      return found
        ? current.map((friend) => (friend.id === next.id ? next : friend))
        : [...current, next];
    });
    setSuggestions((current) => current.filter((friend) => friend.id !== next.id));
  }

  async function searchFriendSuggestions(searchQuery = query) {
    setSearching(true);
    setSearchError(undefined);
    try {
      const params = new URLSearchParams({ mode: "discover", q: searchQuery.trim() });
      const response = await fetch(`/api/friends?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("Search is unavailable.");
      const body = (await response.json()) as FriendsListDto;
      setSuggestions(body.friends);
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : "Search is unavailable.");
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }

  function selectMode(nextMode: WorkspaceMode) {
    setMode(nextMode);
    if (nextMode === "discover") void searchFriendSuggestions("");
    if (nextMode === "add" && query.trim()) void searchFriendSuggestions(query);
  }

  async function requestFriend(friend: Friend) {
    const response = await fetch(`/api/friends/${encodeURIComponent(friend.id)}/request`, {
      method: "POST",
      headers: { "x-csrf-token": readCsrfToken() },
    });
    if (!response.ok) throw new Error("The friend request could not be sent.");
    updateFriend({ ...friend, relationship: "OUTGOING" });
  }

  return (
    <section className="product-stack" aria-label="Friends workspace">
      <div className="product-chip-row" role="tablist" aria-label="Friend views">
        <Button
          variant={mode === "friends" ? "secondary" : "ghost"}
          onClick={() => selectMode("friends")}
        >
          <span>Friends</span>
        </Button>
        <Button
          variant={mode === "requests" ? "secondary" : "ghost"}
          onClick={() => selectMode("requests")}
        >
          <span>Requests</span>
        </Button>
        <Button variant={mode === "add" ? "secondary" : "ghost"} onClick={() => selectMode("add")}>
          <span>Add</span>
        </Button>
        <Button
          variant={mode === "discover" ? "secondary" : "ghost"}
          onClick={() => selectMode("discover")}
        >
          <span>Discover</span>
        </Button>
      </div>

      {mode === "friends" ? (
        <>
          <FriendList
            items={friends}
            emptyTitle="No friends yet"
            emptyDescription="Accepted friends will appear here."
            onChanged={updateFriend}
          />
          {blocked.length ? (
            <div className="product-stack">
              <h2>Blocked users</h2>
              <FriendList
                items={blocked}
                emptyTitle="No blocked users"
                emptyDescription="Blocked accounts stay separate from friendship actions."
                onChanged={updateFriend}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "requests" ? (
        <FriendList
          items={requests}
          emptyTitle="No pending requests"
          emptyDescription="Incoming and outgoing friend requests will appear here."
          onChanged={updateFriend}
        />
      ) : null}

      {mode === "add" || mode === "discover" ? (
        <div className="product-stack">
          <form
            className="product-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void searchFriendSuggestions();
            }}
          >
            <Input
              label={mode === "add" ? "Find a user" : "Search suggestions"}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Username or display name"
              autoComplete="off"
            />
            <Button type="submit" variant="secondary" loading={searching}>
              Search
            </Button>
          </form>
          {searchError ? <p role="alert">{searchError}</p> : null}
          <div className="product-list">
            {suggestions.map((friend) => (
              <article key={friend.id} className="product-list-row">
                <Link
                  className="product-list-row__identity"
                  to={`/u/${encodeURIComponent(friend.username)}`}
                >
                  <CosmeticIdentity
                    displayName={friend.displayName}
                    avatarUrl={friend.avatarUrl}
                    mode="compact"
                    nameAs="strong"
                  />
                  <span className="product-list-row__copy">@{friend.username}</span>
                </Link>
                <ConfirmAction
                  title="Send friend request?"
                  description={`Send a friend request to ${friend.displayName}.`}
                  triggerLabel="Add friend"
                  confirmLabel="Send request"
                  onConfirm={() => requestFriend(friend)}
                />
              </article>
            ))}
          </div>
          {!searching && !searchError && suggestions.length === 0 ? (
            <Card className="product-empty-state">
              <h2>{mode === "discover" ? "No suggestions available" : "Search for someone"}</h2>
              <p>
                {mode === "discover"
                  ? "Only public accounts accepting friend requests can be suggested."
                  : "Search by username or display name to send a friend request."}
              </p>
            </Card>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
