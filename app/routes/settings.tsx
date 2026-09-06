import { useState } from "react";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { ThemeControl } from "../components/layout/ThemeControl";
import { Card, Switch } from "../components/ui";

export default function SettingsRoute() {
  const [hideNsfw, setHideNsfw] = useState(true);
  const [blurNsfw, setBlurNsfw] = useState(true);

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, privacy, content and appearance preferences."
      />
      <PresentationNotice>
        Preference changes are local presentation state in Phase 0B.
      </PresentationNotice>

      <div className="product-settings-grid">
        <Card className="product-settings-section">
          <span className="product-eyebrow">Sensitive content</span>
          <h2>NSFW preferences</h2>
          <p>
            These settings later feed server-side visibility, search and media-gateway enforcement.
          </p>
          <Switch label="Hide NSFW posts" checked={hideNsfw} onCheckedChange={setHideNsfw} />
          <Switch label="Blur NSFW media" checked={blurNsfw} onCheckedChange={setBlurNsfw} />
        </Card>

        <Card className="product-settings-section">
          <span className="product-eyebrow">Interface</span>
          <h2>Appearance</h2>
          <p>Use your operating-system theme by default or override it for SourceBoard.</p>
          <ThemeControl />
        </Card>

        <Card className="product-settings-section">
          <span className="product-eyebrow">Privacy</span>
          <h2>Profile visibility</h2>
          <p>
            Public social links and friendship controls will connect to persisted preferences later.
          </p>
          <Switch label="Show social links publicly" defaultChecked />
          <Switch label="Allow friend requests" defaultChecked />
        </Card>

        <Card className="product-settings-section">
          <span className="product-eyebrow">Security</span>
          <h2>Sessions</h2>
          <p>Session inventory is intentionally unavailable until authentication is implemented.</p>
          <div className="product-store-preview-status">No persisted sessions in this phase.</div>
        </Card>
      </div>
    </ProductShell>
  );
}
