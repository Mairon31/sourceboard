import { useLoaderData } from "react-router";
import { fixtureUiDataAdapter } from "../data/ui-adapter";
import { PostCard } from "../components/product/PostCard";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Avatar, Badge, Button, Card } from "../components/ui";

export async function loader({ params }: { params: { username?: string } }) {
  const profile = await fixtureUiDataAdapter.getProfile(params.username ?? "");
  if (!profile) throw new Response("Profile not found", { status: 404 });
  return { profile };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function ProfileRoute() {
  const { profile } = useLoaderData<LoaderData>();

  return (
    <ProductShell wide>
      <Card className="product-profile-hero">
        <div
          className="product-profile-banner"
          aria-label={`${profile.displayName} profile banner`}
        />
        <div className="product-profile-content">
          <div className="product-profile-identity">
            <div className="product-list-row__identity">
              <Avatar name={profile.displayName} src={profile.avatarUrl} size="xl" />
              <div className="product-profile-name">
                <span className="product-eyebrow">{profile.roleLabel}</span>
                <h1>{profile.displayName}</h1>
                <p>@{profile.username}</p>
              </div>
            </div>
            <Button variant="secondary">Add friend</Button>
          </div>
          <p>{profile.bio}</p>
          <div className="product-profile-stats">
            <div className="product-stat">
              <strong>{profile.points}</strong>
              <span>Points</span>
            </div>
            <div className="product-stat">
              <strong>{profile.reputation}</strong>
              <span>Reputation</span>
            </div>
            <div className="product-stat">
              <strong>{profile.verifiedSources}</strong>
              <span>Verified sources</span>
            </div>
            <div className="product-stat">
              <strong>{profile.friendCount}</strong>
              <span>Friends</span>
            </div>
          </div>
          <div className="product-social-links">
            {profile.socialLinks.map((link) => (
              <a key={link.label} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
          <div className="product-chip-row">
            {profile.equippedCosmetics.map((item) => (
              <span key={item} className="product-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <PageHeader
        eyebrow="Reputation"
        title="Achievements"
        description="Recognition earned from useful source contributions."
      />
      <div className="product-achievement-grid">
        {profile.achievements.map((achievement) => (
          <Card key={achievement.id} className="product-achievement">
            <Badge tone={achievement.earnedAt ? "success" : "accent"}>
              {achievement.earnedAt ? "Earned" : "Progress"}
            </Badge>
            <h3>{achievement.name}</h3>
            <p>{achievement.description}</p>
            {achievement.progress !== undefined ? (
              <span>{achievement.progress}% complete</span>
            ) : null}
          </Card>
        ))}
      </div>

      <PageHeader eyebrow="Public activity" title="Recent source requests" />
      <div className="product-feed-list">
        {profile.recentPosts.map((post) => (
          <PostCard key={post.id} post={post} compact />
        ))}
      </div>
    </ProductShell>
  );
}
