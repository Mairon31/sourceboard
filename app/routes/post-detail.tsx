import { useLoaderData } from "react-router";
import { fixtureUiDataAdapter } from "../data/ui-adapter";
import { CommentThread } from "../components/product/CommentThread";
import { PostCard } from "../components/product/PostCard";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { SourceResolution } from "../components/product/SourceResolution";
import { Badge, Button, Card } from "../components/ui";

export async function loader({ params }: { params: { postId?: string } }) {
  const post = await fixtureUiDataAdapter.getPost(params.postId ?? "");
  if (!post) throw new Response("Post not found", { status: 404 });
  return { post };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function PostDetailRoute() {
  const { post } = useLoaderData<LoaderData>();

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Source request"
        title={post.title}
        description="Post detail and source evidence"
      />
      <PostCard post={post} />

      <SourceResolution accepted={post.acceptedSource} verified={post.verifiedSource} />

      {post.permissions.canModerate || post.permissions.canVerifySource ? (
        <Card className="product-form-card">
          <div className="product-section-heading">
            <div>
              <span className="product-eyebrow">Permission-aware preview</span>
              <h2>Moderation controls</h2>
            </div>
            <Badge tone="warning">Staff view</Badge>
          </div>
          <div className="product-chip-row">
            {post.permissions.canMarkNsfw ? <Button variant="secondary">Mark NSFW</Button> : null}
            {post.permissions.canVerifySource ? (
              <Button variant="secondary">Verify source</Button>
            ) : null}
            {post.permissions.canModerate ? <Button variant="ghost">Moderate post</Button> : null}
          </div>
          <PresentationNotice>
            These controls do not perform moderation writes in Phase 0B.
          </PresentationNotice>
        </Card>
      ) : null}

      <CommentThread comments={post.comments} />
    </ProductShell>
  );
}
