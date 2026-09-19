# Navigation performance

## Findings

Production navigation is a real React Router SPA: the measured transitions did
not request a second HTML document. The dominant requests were route data
loaders, especially the root home loader and public profile loader. D1 query
plans for profile activity used the existing author index and completed in
sub-millisecond local profiling, so the fix targets avoidable round trips and
waterfalls rather than adding speculative indexes.

## Decisions

- Root session data is reused by the top bar instead of fetching the session a
  second time after every shell mount.
- Independent category, reaction, permission, profile-activity, and accepted-
  source reads run concurrently.
- Public username reads stay read-only; they no longer create and immediately
  re-read missing profile defaults.
- Store previews and global entitlements use bounded batch queries instead of
  one query per pack.
- Primary navigation keeps intent prefetch; feed cards are not viewport-
  prefetched wholesale.

## Verification

Run `node scripts/measure-navigation.mjs` against production or a production-
equivalent build. It records cold document loads, warm SPA transitions,
route-data timing, request duplication, response headers, and Chromium traces
under `test-results/performance/`. Keep baseline and after runs separate and
compare medians across repeated desktop and mobile runs.

The worker adds a non-sensitive `Server-Timing: worker;dur=...` metric to HTTP
responses. WebSocket `101` responses are returned unchanged so the accepted
socket handle is preserved.
