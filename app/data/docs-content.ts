export type DocsArticleKind = "guide" | "policy" | "support";

export interface DocsSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface DocsArticle {
  slug: string;
  title: string;
  summary: string;
  kind: DocsArticleKind;
  group: string;
  reviewRequired?: boolean;
  sections: DocsSection[];
}

export const DOCS_ARTICLES: DocsArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "Publish a source request and understand the SourceBoard workflow.",
    kind: "guide",
    group: "Using SourceBoard",
    sections: [
      {
        id: "request",
        title: "Create a source request",
        paragraphs: [
          "Start with one image and a focused question. Add the context you already know instead of guessing at a creator or origin.",
        ],
        bullets: [
          "Choose the correct visibility before publishing.",
          "Mark sensitive imagery accurately.",
          "Keep the title specific enough that people can investigate the same question.",
        ],
      },
      {
        id: "evidence",
        title: "Follow the evidence trail",
        paragraphs: [
          "Comments can contribute candidate sources, context and links. A useful source answer should make it possible for another person to verify the claim independently.",
        ],
      },
      {
        id: "resolution",
        title: "Resolve the request",
        paragraphs: [
          "The post author may accept a source when the evidence answers the request. SourceBoard records that Accepted Source separately from later verification or moderation state.",
        ],
      },
    ],
  },
  {
    slug: "accepted-sources",
    title: "Accepted Sources",
    summary: "How source acceptance, verification, disputes and provenance differ.",
    kind: "guide",
    group: "Using SourceBoard",
    sections: [
      {
        id: "accepted",
        title: "What Accepted Source means",
        paragraphs: [
          "Accepted Source records the post author's selected answer to a source request. It does not transfer copyright, establish legal ownership or make every statement in a comment independently verified.",
        ],
      },
      {
        id: "verification",
        title: "Verification is a separate state",
        paragraphs: [
          "Source Integrity review can add verification, dispute or revoke a resolution when evidence changes. The audit trail preserves the history instead of silently rewriting it.",
        ],
      },
      {
        id: "machine-readable",
        title: "Public provenance",
        paragraphs: [
          "For public posts, SourceBoard exposes structured information so crawlers and automated systems can distinguish the request image, public author, accepted source URL, evidence and status. Private account data is not part of that public provenance surface.",
        ],
      },
    ],
  },
  {
    slug: "comments",
    title: "Comments and discussion",
    summary: "Replies, source leads, reactions, media and closed discussions.",
    kind: "guide",
    group: "Using SourceBoard",
    sections: [
      {
        id: "useful-comments",
        title: "Add useful context",
        paragraphs: [
          "Comments support Markdown, source links and eligible media. Prefer information that advances the source trail over speculation or repeated guesses.",
        ],
      },
      {
        id: "closed",
        title: "Closed comments",
        paragraphs: [
          "After a source has been accepted, the post author can close comments. Existing discussion remains visible, while the server rejects new comments until the author reopens the discussion when that action is available.",
        ],
      },
      {
        id: "moderation",
        title: "Editing, deletion and moderation",
        paragraphs: [
          "Edits and deletes update the visible discussion without requiring a manual page refresh. Moderated or removed content may retain internal audit data even when it is no longer publicly visible.",
        ],
      },
    ],
  },
  {
    slug: "friends",
    title: "Friends and discovery",
    summary: "Requests, accepted friends, discovery, blocks and profile privacy.",
    kind: "guide",
    group: "Social",
    sections: [
      {
        id: "requests",
        title: "Friend requests",
        paragraphs: [
          "Friend requests are private account state. Incoming and outgoing requests stay separate until accepted, and a user can disable new requests through supported privacy settings.",
        ],
      },
      {
        id: "visibility",
        title: "Friendship does not override privacy",
        paragraphs: [
          "Server-side policy still decides whether a viewer can access a profile or friends-only content. Blocking takes precedence over friendship and discovery surfaces.",
        ],
      },
    ],
  },
  {
    slug: "store-and-points",
    title: "Store, points and contributions",
    summary: "How points are earned, protected from farming and spent on cosmetics.",
    kind: "guide",
    group: "Account and personalization",
    sections: [
      {
        id: "earning",
        title: "Earn points through participation",
        paragraphs: [
          "SourceBoard awards bounded points for useful interactions such as source requests, comments, eligible likes, friendship actions and one-time profile completion. Accepted and Verified Source rewards use separate versioned rules.",
        ],
        bullets: [
          "Post: 3 points, up to 5 rewarded posts per day.",
          "Comment: 2 points, up to 15 rewarded comments per day.",
          "Eligible post/comment like: 1 point, with daily caps and no self-like reward.",
          "Profile avatar, bio and first public social link: one-time completion rewards.",
          "Share action: a bounded share-intent reward, not proof that an external share was published or viewed.",
        ],
      },
      {
        id: "anti-abuse",
        title: "Anti-abuse rules",
        paragraphs: [
          "Rewards use server-generated amounts, deterministic idempotency keys and daily limits. Repeating the same like, removing and re-adding the same friend, retrying a request or toggling profile fields cannot farm the same reward.",
          "When rewarded posts or comments are deleted, SourceBoard appends a reversal to the ledger instead of modifying historical entries.",
        ],
      },
      {
        id: "store",
        title: "Spend and equip",
        paragraphs: [
          "Store items may cost points or be Free. Global emote packs are available without individual ownership rows. Cosmetic equipment is separate from ownership, so unequipping an item does not remove it from inventory.",
        ],
      },
    ],
  },
  {
    slug: "account-verification",
    title: "Account and email verification",
    summary: "Registration, Google sign-in, Firebase email verification and sessions.",
    kind: "support",
    group: "Account and personalization",
    sections: [
      {
        id: "register",
        title: "Registration security",
        paragraphs: [
          "Registration uses Cloudflare Turnstile and server-side validation. Security checks are part of the authentication flow rather than decorative client-only controls.",
        ],
      },
      {
        id: "verify",
        title: "Firebase verification handoff",
        paragraphs: [
          "When Firebase verifies an email, SourceBoard synchronizes that verified identity instead of requiring an unrelated second verification. Verification links may return with Firebase's oobCode and continue through the SourceBoard handoff.",
        ],
      },
      {
        id: "sessions",
        title: "Sessions",
        paragraphs: [
          "Sessions are server-managed and can be invalidated by account security or moderation actions. Signing out ends the current browser session; supported security controls may end other sessions as well.",
        ],
      },
    ],
  },
  {
    slug: "moderation-and-reports",
    title: "Moderation and reports",
    summary: "Reporting content, sanctions, Source Integrity and administrative audit trails.",
    kind: "support",
    group: "Safety and support",
    sections: [
      {
        id: "reports",
        title: "Report content",
        paragraphs: [
          "Use the report action for spam, harassment, misleading sources, sensitive content, privacy issues, copyright concerns or other policy problems. Reports are reviewed separately from public discussion.",
        ],
      },
      {
        id: "actions",
        title: "Moderation actions",
        paragraphs: [
          "Administrative actions can include posting/comment restrictions, suspension, bans, role changes, session invalidation and account handling. Strong actions require server-side capability checks and an audit reason.",
        ],
      },
      {
        id: "source-integrity",
        title: "Source Integrity",
        paragraphs: [
          "Accepted Sources can be reviewed as accepted, disputed, suspicious, verified or revoked without collapsing those states into a separate competing verification system.",
        ],
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    summary: "Common account, media, Store and stale-interface problems.",
    kind: "support",
    group: "Safety and support",
    sections: [
      {
        id: "auth",
        title: "Login or registration does not complete",
        paragraphs: [
          "Confirm that the Cloudflare security check loaded and that cookies are allowed for SourceBoard. If an old tab has stale security state, retry the form from the current page rather than reusing an old submission.",
        ],
      },
      {
        id: "verification",
        title: "Firebase says verified but SourceBoard does not",
        paragraphs: [
          "Return to SourceBoard and sign in with the same identity. The login flow synchronizes Firebase verification state. Do not submit a separate legacy token unless the link actually contains one.",
        ],
      },
      {
        id: "updates",
        title: "A change appears stale",
        paragraphs: [
          "SourceBoard mutations are designed to reconcile locally or revalidate the current route. If a current production build still requires a manual refresh after a successful mutation, report the page and action because that is treated as a product defect.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Use",
    summary: "Baseline terms for using SourceBoard and contributing public content.",
    kind: "policy",
    group: "Policies",
    reviewRequired: true,
    sections: [
      {
        id: "service",
        title: "Using the service",
        paragraphs: [
          "Use SourceBoard only in ways permitted by applicable law and these product policies. Features, limits and availability can change as the service evolves.",
        ],
      },
      {
        id: "content",
        title: "Your contributions",
        paragraphs: [
          "You remain responsible for content you submit and for having the rights or lawful basis needed to submit it. SourceBoard's source-resolution labels do not grant ownership of third-party work.",
        ],
      },
      {
        id: "enforcement",
        title: "Enforcement",
        paragraphs: [
          "SourceBoard may restrict or remove access when needed to enforce product rules, protect users or operate the service. This summary is product documentation and should receive legal review before being treated as final contractual text.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy",
    summary: "What SourceBoard keeps private and what becomes public when you publish.",
    kind: "policy",
    group: "Policies",
    reviewRequired: true,
    sections: [
      {
        id: "public",
        title: "Public information",
        paragraphs: [
          "Public profiles, public source requests, visible comments and public source-resolution metadata can be delivered to visitors and crawlers. The interface should make the relevant visibility choice clear before publication.",
        ],
      },
      {
        id: "private",
        title: "Private account data",
        paragraphs: [
          "Email addresses, sessions, moderation notes, administrative data, private or friends-only content and non-public profile information are not intentionally exposed through public pages, sitemaps or structured public metadata.",
        ],
      },
      {
        id: "controls",
        title: "Privacy controls",
        paragraphs: [
          "Supported settings govern profile visibility, friend requests, sensitive-content presentation, blocks and other product privacy choices. This page describes current product behavior and requires legal review for jurisdiction-specific privacy obligations.",
        ],
      },
    ],
  },
  {
    slug: "community-guidelines",
    title: "Community Guidelines",
    summary: "Rules for useful, safe source-finding discussions.",
    kind: "policy",
    group: "Policies",
    reviewRequired: true,
    sections: [
      {
        id: "evidence",
        title: "Prefer evidence over certainty",
        paragraphs: [
          "Do not present an uncertain attribution as established fact. Explain how a link, creator identity or publication relates to the request and correct mistakes when better evidence appears.",
        ],
      },
      {
        id: "conduct",
        title: "Respect people",
        paragraphs: [
          "Do not use SourceBoard for harassment, threats, targeted abuse, doxxing, impersonation, spam or attempts to expose private personal information.",
        ],
      },
      {
        id: "moderation",
        title: "Moderation",
        paragraphs: [
          "Report policy violations instead of escalating them in comments. Moderation decisions and Source Integrity decisions can use separate review and audit trails.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use",
    summary: "Prohibited abuse of SourceBoard accounts, automation and infrastructure.",
    kind: "policy",
    group: "Policies",
    reviewRequired: true,
    sections: [
      {
        id: "abuse",
        title: "Do not abuse the service",
        paragraphs: [
          "Do not bypass rate limits, security checks, access controls or moderation restrictions. Do not automate interactions primarily to farm points, manipulate engagement or overwhelm other users or infrastructure.",
        ],
      },
      {
        id: "security",
        title: "Security",
        paragraphs: [
          "Do not probe for private data, attempt unauthorized account access, upload malicious payloads or use SourceBoard to distribute malware or deceptive links.",
        ],
      },
    ],
  },
  {
    slug: "copyright-and-attribution",
    title: "Copyright, DMCA and attribution",
    summary: "How source attribution relates to copyright and removal requests.",
    kind: "policy",
    group: "Policies",
    reviewRequired: true,
    sections: [
      {
        id: "attribution",
        title: "Attribution is not ownership",
        paragraphs: [
          "Accepted Source and verification labels are provenance tools. They do not transfer copyright, create a license or replace the rights of the original creator.",
        ],
      },
      {
        id: "requests",
        title: "Copyright concerns",
        paragraphs: [
          "SourceBoard should provide a documented process for copyright or takedown requests and preserve enough internal information to investigate them. The final notice-and-takedown procedure, designated contacts and jurisdiction-specific language require legal review before launch.",
        ],
      },
    ],
  },
  {
    slug: "data-handling",
    title: "Data Handling",
    summary: "Operational storage, private media and account-data boundaries.",
    kind: "policy",
    group: "Policies",
    reviewRequired: true,
    sections: [
      {
        id: "storage",
        title: "Service data",
        paragraphs: [
          "SourceBoard stores the account, profile, post, comment, relationship, Store, audit and moderation records needed to operate supported features. D1 remains authoritative for application state.",
        ],
      },
      {
        id: "media",
        title: "Media",
        paragraphs: [
          "Uploaded media is stored in object storage and delivered through SourceBoard routes according to the relevant access policy. Private media should not be converted into publicly enumerable object URLs.",
        ],
      },
    ],
  },
  {
    slug: "ai-public-content",
    title: "AI and public content",
    summary:
      "How public SourceBoard pages are made understandable to crawlers and automated systems.",
    kind: "policy",
    group: "Policies",
    reviewRequired: true,
    sections: [
      {
        id: "crawlable",
        title: "Machine-readable public pages",
        paragraphs: [
          "Public posts can include semantic HTML, canonical URLs, structured metadata, sitemaps and explicit Accepted Source provenance so search engines and automated systems can understand the public source trail.",
        ],
      },
      {
        id: "no-promise",
        title: "No training promise",
        paragraphs: [
          "Making public content crawlable does not mean SourceBoard can promise that Google, OpenAI or any other external system will index, use or train on a particular page. External systems make their own decisions under their own policies.",
        ],
      },
      {
        id: "private",
        title: "Private data stays out of the public surface",
        paragraphs: [
          "Emails, sessions, moderation notes, admin data, private profiles, friends-only posts and hidden comments are excluded from the intended public crawler and structured-data surface.",
        ],
      },
    ],
  },
  {
    slug: "support",
    title: "Help and support",
    summary: "What to include when reporting a SourceBoard product problem.",
    kind: "support",
    group: "Safety and support",
    sections: [
      {
        id: "report",
        title: "Report a product problem",
        paragraphs: [
          "Include the page, the action you attempted, what you expected and what actually happened. For visual defects, a screenshot and viewport size are especially useful. Do not include passwords, session cookies or authentication tokens.",
        ],
      },
      {
        id: "account",
        title: "Account or safety issue",
        paragraphs: [
          "Use in-product reporting for content or conduct issues when available. Account-security and privacy incidents should be handled through a dedicated support path before public launch; final contact details still need operational and legal review.",
        ],
      },
    ],
  },
];

export const DOCS_GROUPS = [
  "Using SourceBoard",
  "Social",
  "Account and personalization",
  "Safety and support",
  "Policies",
] as const;

export function docsArticle(slug: string): DocsArticle | undefined {
  return DOCS_ARTICLES.find((article) => article.slug === slug);
}

export function docsByGroup(group: string): DocsArticle[] {
  return DOCS_ARTICLES.filter((article) => article.group === group);
}
