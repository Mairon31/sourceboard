import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { FriendsListDto, Relationship } from "../../../worker/profile/types";
import { readCsrfToken } from "../../data/csrf";
import type { MessageKey } from "../../i18n";
import { useI18n } from "../../i18n/I18nProvider";
import { Button, Input } from "../ui";
import { ConfirmAction } from "./ConfirmAction";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { SocialActionButton } from "./SocialActionButton";

type Friend = FriendsListDto["friends"][number];
type WorkspaceMode = "friends" | "incoming" | "outgoing" | "add" | "discover" | "blocked";
type ConfirmedAction = "accept" | "decline" | "remove";

const relationshipLabelKeys: Record<Relationship, MessageKey> = {
  FRIEND: "friends.relationship.friend",
  INCOMING: "friends.relationship.incoming",
  OUTGOING: "friends.relationship.outgoing",
  BLOCKED: "friends.relationship.blocked",
  NONE: "friends.relationship.none",
};

const workspaceLabelKeys: Record<WorkspaceMode, MessageKey> = {
  friends: "friends.workspace.friends",
  incoming: "friends.workspace.incoming",
  outgoing: "friends.workspace.outgoing",
  add: "friends.workspace.add",
  discover: "friends.workspace.discover",
  blocked: "friends.workspace.blocked",
};

const tabLabelKeys: Record<WorkspaceMode, MessageKey> = {
  friends: "friends.tab.friends",
  incoming: "friends.tab.incoming",
  outgoing: "friends.tab.outgoing",
  add: "friends.tab.add",
  discover: "friends.tab.discover",
  blocked: "friends.tab.blocked",
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

async function mutateRelationship(
  friend: Friend,
  action: ConfirmedAction,
  errorMessage: string,
): Promise<void> {
  const target = actionEndpoint(friend, action);
  const response = await fetch(target.endpoint, {
    method: target.method,
    headers: { "x-csrf-token": readCsrfToken() },
  });
  if (!response.ok) throw new Error(errorMessage);
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
  const { t } = useI18n();
  const nextRelationship: Relationship = action === "accept" ? "FRIEND" : "NONE";
  const labels = {
    accept: {
      title: t("friends.confirm.acceptTitle"),
      description: t("friends.confirm.acceptDescription", { name: friend.displayName }),
      trigger: t("friends.action.accept"),
      confirm: t("friends.action.accept"),
      destructive: false,
    },
    decline: {
      title: t("friends.confirm.declineTitle"),
      description: t("friends.confirm.declineDescription", { name: friend.displayName }),
      trigger: t("friends.action.decline"),
      confirm: t("friends.action.decline"),
      destructive: true,
    },
    remove: {
      title: t("friends.confirm.removeTitle"),
      description: t("friends.confirm.removeDescription", { name: friend.displayName }),
      trigger: t("friends.action.remove"),
      confirm: t("friends.action.remove"),
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
        await mutateRelationship(friend, action, t("friends.error.relationship"));
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
  const { t } = useI18n();
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
        {t("friends.action.cancel")}
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
        {t("friends.action.unblock")}
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
  const { t } = useI18n();
  return (
    <article className="product-list-row product-friend-row">
      <Link className="product-list-row__identity" to={`/u/${encodeURIComponent(friend.username)}`}>
        <FriendIdentity friend={friend} />
        <span className="product-list-row__copy">
          <span>@{friend.username}</span>
          <small>{t(relationshipLabelKeys[friend.relationship])}</small>
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
  const { t } = useI18n();
  return (
    <Button
      variant={activeMode === mode ? "secondary" : "ghost"}
      role="tab"
      aria-selected={activeMode === mode}
      aria-controls={`${mode}-panel`}
      onClick={() => onSelect(mode)}
    >
      {t(tabLabelKeys[mode])}
      {count !== undefined ? <span className="product-friends-tab-count">{count}</span> : null}
    </Button>
  );
}

export function FriendsWorkspace({ initialFriends }: { initialFriends: Friend[] }) {
  const { t, tp } = useI18n();
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
      if (!response.ok) throw new Error(t("friends.error.search"));
      const body = (await response.json()) as FriendsListDto;
      setSuggestions(body.friends);
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : t("friends.error.search"));
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
    if (!response.ok) throw new Error(t("friends.error.request"));
    updateFriend({ ...friend, relationship: "OUTGOING" });
  }

  return (
    <section
      className="product-stack product-friends-workspace"
      aria-label={t("friends.workspaceAria")}
    >
      <div className="product-friends-overview">
        <div className="product-friends-summary">
          <div>
            <span className="product-eyebrow">{t("friends.network")}</span>
            <h2>{t(workspaceLabelKeys[mode])}</h2>
          </div>
          <div className="product-friends-summary__metrics" aria-label={t("friends.countsAria")}>
            <span>{tp("friends.metric.friends", friends.length)}</span>
            <span>{tp("friends.metric.pending", pendingCount)}</span>
            <span>{tp("friends.metric.blocked", blocked.length)}</span>
          </div>
        </div>

        <div className="product-friends-tabs" role="tablist" aria-label={t("friends.viewsAria")}>
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
          aria-label={t("friends.workspace.friends")}
          className="product-friends-panel"
        >
          <FriendList
            items={friends}
            emptyTitle={t("friends.empty.friendsTitle")}
            emptyDescription={t("friends.empty.friendsDescription")}
            onChanged={updateFriend}
          />
        </div>
      ) : null}

      {mode === "incoming" ? (
        <div
          id="incoming-panel"
          role="tabpanel"
          aria-label={t("friends.workspace.incoming")}
          className="product-friends-panel"
        >
          <FriendList
            items={incoming}
            emptyTitle={t("friends.empty.incomingTitle")}
            emptyDescription={t("friends.empty.incomingDescription")}
            onChanged={updateFriend}
          />
        </div>
      ) : null}

      {mode === "outgoing" ? (
        <div
          id="outgoing-panel"
          role="tabpanel"
          aria-label={t("friends.workspace.outgoing")}
          className="product-friends-panel"
        >
          <FriendList
            items={outgoing}
            emptyTitle={t("friends.empty.outgoingTitle")}
            emptyDescription={t("friends.empty.outgoingDescription")}
            onChanged={updateFriend}
          />
        </div>
      ) : null}

      {mode === "blocked" ? (
        <div
          id="blocked-panel"
          role="tabpanel"
          aria-label={t("friends.workspace.blocked")}
          className="product-friends-panel"
        >
          <FriendList
            items={blocked}
            emptyTitle={t("friends.empty.blockedTitle")}
            emptyDescription={t("friends.empty.blockedDescription")}
            onChanged={updateFriend}
          />
        </div>
      ) : null}

      {mode === "add" || mode === "discover" ? (
        <div
          id={`${mode}-panel`}
          role="tabpanel"
          aria-label={t(workspaceLabelKeys[mode])}
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
              label={
                mode === "add"
                  ? t("friends.search.findLabel")
                  : t("friends.search.suggestionsLabel")
              }
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t("friends.search.placeholder")}
              autoComplete="off"
            />
            <Button type="submit" variant="secondary" loading={searching}>
              {t("friends.search.submit")}
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
                  title={t("friends.confirm.sendTitle")}
                  description={t("friends.confirm.sendDescription", { name: friend.displayName })}
                  triggerLabel={t("friends.action.add")}
                  confirmLabel={t("friends.action.send")}
                  onConfirm={() => requestFriend(friend)}
                />
              </article>
            ))}
          </div>
          {!searching && !searchError && suggestions.length === 0 ? (
            <EmptyFriends
              title={
                mode === "discover"
                  ? t("friends.empty.suggestionsTitle")
                  : t("friends.empty.searchTitle")
              }
              description={
                mode === "discover"
                  ? t("friends.empty.suggestionsDescription")
                  : t("friends.empty.searchDescription")
              }
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
