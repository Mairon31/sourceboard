import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { FriendsListDto, Relationship } from "../../../worker/profile/types";
import { readCsrfToken } from "../../data/csrf";
import { Button, Input } from "../ui";
import { ConfirmAction } from "./ConfirmAction";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { SocialActionButton } from "./SocialActionButton";

type Friend = FriendsListDto["friends"][number];
type WorkspaceMode = "friends" | "incoming" | "outgoing" | "add" | "discover" | "blocked";
type ConfirmedAction = "accept" | "decline" | "remove";

const relationshipLabel: Record<Relationship, string> = {
  FRIEND: "Friend",
  INCOMING: "Incoming request",
  OUTGOING: "Request sent",
  BLOCKED: "Blocked",
  NONE: "Not connected",
};

const workspaceLabels: Record<WorkspaceMode, string> = {
  friends: "Your friends",
  incoming: "Incoming requests",
  outgoing: "Sent requests",
  add: "Find someone",
  discover: "Suggested accounts",
  blocked: "Blocked accounts",
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
  if (!response.ok) throw new Error("The relationship could not be updated.");
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
      <div className="product-chip-row product-friend-row__actions">
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

function FriendIdentity({ friend }: { friend: Friend }) {
  return (
    <CosmeticIdentity
      displayName={friend.displayName}
      avatarUrl={friend.avatarUrl}
      avatarFrame={friend.cosmetics?.avatarFrame}
      nameFont={friend.cosmetics?.nameFont}
      nameEffect={friend.cosmetics?.nameEffect}
      visuals={friend.cosmetics?.visuals}
      mode="compact"
      nameAs="strong"
    />
  );
}

function FriendRow({ friend, onChanged }: { friend: Friend; onChanged: (friend: Friend) => void }) {
  return (
    <article className="product-list-row product-friend-row">
      <Link className="product-list-row__identity" to={`/u/${encodeURIComponent(friend.username)}`}>
        <FriendIdentity friend={friend} />
        <span className="product-list-row__copy">
          <span>@{friend.username}</span>
          <small>{relationshipLabel[friend.relationship]}</small>
        </span>
      </Link>
      <FriendActions friend={friend} onChanged={onChanged} />
    </article>
  );
}

function EmptyFriends({ title, description }: { title: string; description: string }) {
  return (
    <div className="product-empty-state product-empty-state--compact product-friends-empty">
      <div className="product-friends-empty__mark" aria-hidden="true">
        ◎
      </div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
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
    return <EmptyFriends title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="product-list product-friends-list">
      {items.map((friend) => (
        <FriendRow key={friend.id} friend={friend} onChanged={onChanged} />
      ))}
    </div>
  );
}

function WorkspaceTab({
  mode,
  activeMode,
  count,
  onSelect,
}: {
  mode: WorkspaceMode;
  activeMode: WorkspaceMode;
  count?: number;
  onSelect: (mode: WorkspaceMode) => void;
}) {
  const label = {
    friends: "Friends",
    incoming: "Incoming",
    outgoing: "Outgoing",
    add: "Add",
    discover: "Discover",
    blocked: "Blocked",
  }[mode];
  return (
    <Button
      variant={activeMode === mode ? "secondary" : "ghost"}
      role="tab"
      aria-selected={activeMode === mode}
      aria-controls={`${mode}-panel`}
      onClick={() => onSelect(mode)}
    >
      {label}
      {count !== undefined ? <span className="product-friends-tab-count">{count}</span> : null}
    </Button>
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
  const incoming = useMemo(
    () => connections.filter((friend) => friend.relationship === "INCOMING"),
    [connections],
  );
  const outgoing = useMemo(
    () => connections.filter((friend) => friend.relationship === "OUTGOING"),
    [connections],
  );
  const blocked = useMemo(
    () => connections.filter((friend) => friend.relationship === "BLOCKED"),
    [connections],
  );
  const pendingCount = incoming.length + outgoing.length;

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
    <section className="product-stack product-friends-workspace" aria-label="Friends workspace">
      <div className="product-friends-overview">
        <div className="product-friends-summary">
          <div>
            <span className="product-eyebrow">Your network</span>
            <h2>{workspaceLabels[mode]}</h2>
          </div>
          <div className="product-friends-summary__metrics" aria-label="Connection counts">
            <span>
              <strong>{friends.length}</strong> friends
            </span>
            <span>
              <strong>{pendingCount}</strong> pending
            </span>
            <span>
              <strong>{blocked.length}</strong> blocked
            </span>
          </div>
        </div>

        <div className="product-friends-tabs" role="tablist" aria-label="Friend views">
          <WorkspaceTab
            mode="friends"
            activeMode={mode}
            count={friends.length}
            onSelect={selectMode}
          />
          <WorkspaceTab
            mode="incoming"
            activeMode={mode}
            count={incoming.length}
            onSelect={selectMode}
          />
          <WorkspaceTab
            mode="outgoing"
            activeMode={mode}
            count={outgoing.length}
            onSelect={selectMode}
          />
          <WorkspaceTab mode="add" activeMode={mode} onSelect={selectMode} />
          <WorkspaceTab mode="discover" activeMode={mode} onSelect={selectMode} />
          <WorkspaceTab
            mode="blocked"
            activeMode={mode}
            count={blocked.length}
            onSelect={selectMode}
          />
        </div>
      </div>

      {mode === "friends" ? (
        <div
          id="friends-panel"
          role="tabpanel"
          aria-label="Your friends"
          className="product-friends-panel"
        >
          <FriendList
            items={friends}
            emptyTitle="No friends yet"
            emptyDescription="Accepted friends will appear here."
            onChanged={updateFriend}
          />
        </div>
      ) : null}

      {mode === "incoming" ? (
        <div
          id="incoming-panel"
          role="tabpanel"
          aria-label="Incoming friend requests"
          className="product-friends-panel"
        >
          <FriendList
            items={incoming}
            emptyTitle="No incoming requests"
            emptyDescription="New friend requests will appear here."
            onChanged={updateFriend}
          />
        </div>
      ) : null}

      {mode === "outgoing" ? (
        <div
          id="outgoing-panel"
          role="tabpanel"
          aria-label="Outgoing friend requests"
          className="product-friends-panel"
        >
          <FriendList
            items={outgoing}
            emptyTitle="No sent requests"
            emptyDescription="Requests you send will stay here until they are accepted or cancelled."
            onChanged={updateFriend}
          />
        </div>
      ) : null}

      {mode === "blocked" ? (
        <div
          id="blocked-panel"
          role="tabpanel"
          aria-label="Blocked accounts"
          className="product-friends-panel"
        >
          <FriendList
            items={blocked}
            emptyTitle="No blocked accounts"
            emptyDescription="Accounts you block will appear here without being mixed into your friends list."
            onChanged={updateFriend}
          />
        </div>
      ) : null}

      {mode === "add" || mode === "discover" ? (
        <div
          id={`${mode}-panel`}
          role="tabpanel"
          aria-label={workspaceLabels[mode]}
          className="product-stack product-friends-panel"
        >
          <form
            className="product-friends-search"
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
          <div className="product-list product-friends-list">
            {suggestions.map((friend) => (
              <article key={friend.id} className="product-list-row product-friend-row">
                <Link
                  className="product-list-row__identity"
                  to={`/u/${encodeURIComponent(friend.username)}`}
                >
                  <FriendIdentity friend={friend} />
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
            <EmptyFriends
              title={mode === "discover" ? "No suggestions available" : "Search for someone"}
              description={
                mode === "discover"
                  ? "Only public accounts accepting friend requests can be suggested."
                  : "Search by username or display name to send a friend request."
              }
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
