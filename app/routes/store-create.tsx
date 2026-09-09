import { useLoaderData, type MetaFunction } from "react-router";
import { CommunityCosmeticStudio } from "../components/product/CommunityCosmeticStudio";
import { ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

export const meta: MetaFunction = () => [
  { title: "Create cosmetic · SourceBoard" },
  { name: "description", content: "Build a sandboxed community cosmetic for SourceBoard." },
  { name: "robots", content: "noindex, follow" },
];

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    () => ({ authenticated: false }),
    async (_runtime, userId) => ({ authenticated: Boolean(userId) }),
  );
}

export default function StoreCreateRoute() {
  const { authenticated } = useLoaderData<typeof loader>();
  return (
    <ProductShell wide>
      <div className="product-store-page product-store-create-page">
        <header className="product-store-hero">
          <div>
            <span className="product-eyebrow">Community Studio</span>
            <h1>Create a community cosmetic</h1>
            <p>
              Start from an approved SourceBoard preset, preview safe CSS live, save a draft, then
              submit it for staff review.
            </p>
          </div>
          <a className="product-store-create-link" href="/store">
            Back to Store
          </a>
        </header>
        {authenticated ? (
          <CommunityCosmeticStudio />
        ) : (
          <Card className="product-empty-state">
            <p>Sign in to create and submit community cosmetics.</p>
            <a href="/login">Sign in</a>
          </Card>
        )}
      </div>
    </ProductShell>
  );
}
