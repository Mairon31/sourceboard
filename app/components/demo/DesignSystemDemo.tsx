import { useState } from "react";
import { AppShell } from "../layout/AppShell";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Dropdown,
  GlassPanel,
  HeartIcon,
  InfoIcon,
  Input,
  MessageIcon,
  Modal,
  OverlayActionRow,
  PresencePanel,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  ToastProvider,
  Tooltip,
  useSourceBoardToast,
} from "../ui";

function DemoRail() {
  return (
    <GlassPanel className="sb-rail-panel">
      <p className="sb-rail-label">Design system</p>
      <div className="sb-rail-item sb-rail-item--active">Surface language</div>
      <div className="sb-rail-item">Interaction states</div>
      <div className="sb-rail-item">Motion policy</div>
    </GlassPanel>
  );
}

function ContextRail() {
  return (
    <Card className="demo-context-card">
      <Badge tone="accent">Phase 0A</Badge>
      <h3>Visual foundation</h3>
      <p>
        This page proves reusable primitives only. Product data, authentication and persistence are
        intentionally not connected yet.
      </p>
    </Card>
  );
}

function SamplePostCard() {
  const [liked, setLiked] = useState(false);

  return (
    <Card className="demo-post-card">
      <div className="demo-post-header">
        <Avatar name="Mira Chen" />
        <div className="demo-post-author">
          <strong>Mira Chen</strong>
          <span>presentation sample · 12 min</span>
        </div>
        <Badge tone="success">Verified style</Badge>
      </div>

      <div className="demo-post-copy">
        <h3>Which public post did this crop come from?</h3>
        <p>
          A representative SourceBoard content card for judging hierarchy, spacing and contrast.
          It is static presentation data, not a live post.
        </p>
      </div>

      <div className="demo-media" role="img" aria-label="Abstract sample media placeholder">
        <div className="demo-media__window">
          <span />
          <span />
          <span />
        </div>
        <div className="demo-media__lines">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="demo-post-actions" aria-label="Reaction presentation">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={liked}
          onClick={() => setLiked((value) => !value)}
        >
          <HeartIcon width="17" height="17" />
          {liked ? "Liked locally" : "Like motion"}
        </Button>
        <Button variant="ghost" size="sm" disabled>
          <MessageIcon width="17" height="17" />
          Comment preview
        </Button>
      </div>
    </Card>
  );
}

function ControlsPanel() {
  return (
    <div className="demo-control-grid">
      <Card className="demo-control-card">
        <h3>Inputs</h3>
        <Input label="Title" placeholder="Describe what you are trying to identify" />
        <Textarea
          label="Context"
          placeholder="Optional context for the future post composer"
          hint="Presentation only; this text is not submitted anywhere."
        />
      </Card>
      <Card className="demo-control-card">
        <h3>Preferences</h3>
        <Switch
          label="Blur sensitive media"
          description="Example of a future preference control."
          defaultChecked
        />
        <Checkbox
          label="Compact metadata"
          description="Example checkbox state using the same visual system."
        />
        <Button disabled>Disabled action</Button>
      </Card>
    </div>
  );
}

function StatesPanel() {
  return (
    <div className="demo-state-grid">
      <Card className="demo-state-card">
        <Badge tone="neutral">Empty</Badge>
        <h3>No verified answers in this sample</h3>
        <p>Empty states explain what belongs here and what the next useful action would be.</p>
      </Card>
      <Card className="demo-state-card demo-state-card--error">
        <Badge tone="danger">Recoverable error</Badge>
        <h3>Preview could not refresh</h3>
        <p>The visual treatment is direct, readable and does not expose internal error details.</p>
      </Card>
      <Card className="demo-state-card">
        <Badge tone="accent">Loading</Badge>
        <div className="demo-skeleton-stack">
          <Skeleton data-testid="demo-skeleton" height="16px" width="58%" />
          <Skeleton height="12px" width="92%" />
          <Skeleton height="12px" width="76%" />
        </div>
      </Card>
    </div>
  );
}

function DemoContent() {
  const toast = useSourceBoardToast();
  const [showMotionSample, setShowMotionSample] = useState(false);

  const tabs = [
    {
      value: "surface",
      label: "Surface",
      content: <SamplePostCard />,
    },
    {
      value: "controls",
      label: "Controls",
      content: <ControlsPanel />,
    },
    {
      value: "states",
      label: "States",
      content: <StatesPanel />,
    },
  ];

  return (
    <AppShell leftRail={<DemoRail />} rightRail={<ContextRail />}>
      <section className="demo-intro" aria-labelledby="sourceboard-title">
        <div className="demo-intro__meta">
          <Badge tone="accent">Design system</Badge>
          <span>Cloudflare-native · responsive · accessible</span>
        </div>
        <h1 id="sourceboard-title">SourceBoard</h1>
        <h2>Phase 0A visual laboratory</h2>
        <p>
          A restrained Liquid Glass language with deliberate depth, semantic tokens and motion that
          communicates state instead of decorating it.
        </p>
        <p className="demo-disclaimer">
          Presentation only — product persistence arrives in later phases.
        </p>
      </section>

      <section className="demo-toolbar" aria-label="Interactive primitive demonstrations">
        <Modal
          triggerLabel="Open source preview"
          title="Source preview"
          description="Modal semantics and glass elevation without product persistence."
        >
          <div className="demo-preview-panel">
            <Badge tone="success">Accessible dialog</Badge>
            <p>
              Focus is managed by the headless primitive, while SourceBoard owns the visual language.
            </p>
          </div>
          <OverlayActionRow>
            <Button variant="secondary">Presentation action</Button>
          </OverlayActionRow>
        </Modal>

        <Drawer
          triggerLabel="Open mobile drawer"
          title="Drawer preview"
          description="A touch-friendly bottom drawer primitive for compact screens."
        >
          <p>
            The drawer uses the same spacing, elevation and motion tokens as the rest of SourceBoard.
          </p>
        </Drawer>

        <Dropdown
          label="More demo actions"
          items={[
            {
              label: "Copy sample link",
              onSelect: () =>
                toast.show({
                  title: "Presentation action",
                  description: "No link was copied; persistence is intentionally not implemented.",
                }),
            },
            { label: "Unavailable future action", disabled: true },
          ]}
        />

        <Tooltip
          label="Why Liquid Glass?"
          content="Glass is reserved for elevated chrome and overlays."
        >
          <InfoIcon width="17" height="17" />
        </Tooltip>
      </section>

      <Tabs items={tabs} />

      <section className="demo-motion-section">
        <div>
          <Badge tone="neutral">Motion boundary</Badge>
          <h3>CSS first, motion library only where presence matters</h3>
          <p>
            Hover, press and focus stay in CSS. This small presence sample demonstrates the limited
            higher-level motion layer.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowMotionSample((value) => !value)}>
          {showMotionSample ? "Hide motion sample" : "Show motion sample"}
        </Button>
      </section>

      <PresencePanel show={showMotionSample} className="demo-motion-result">
        <GlassPanel>
          <Badge tone="accent">Presence</Badge>
          <strong>One contained transition, not motion wrapped around the whole app.</strong>
        </GlassPanel>
      </PresencePanel>
    </AppShell>
  );
}

export function DesignSystemDemo() {
  return (
    <ToastProvider>
      <DemoContent />
    </ToastProvider>
  );
}
