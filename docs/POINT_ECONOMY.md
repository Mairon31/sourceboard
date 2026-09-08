# SourceBoard point economy

SourceBoard points reward useful participation. The point ledger is server-authoritative and append-only: clients can request an eligible action, but they cannot choose the amount or directly write a balance.

## Contribution rewards

| Action | Points | Daily award cap | Anti-abuse identity |
| --- | ---: | ---: | --- |
| Create a source request | 3 | 5 | One award per post ID |
| Create a comment or source lead | 2 | 15 | One award per comment ID |
| Like another member's post | 1 | 20 | One award per user + post |
| Like another member's comment | 1 | 20 | One award per user + comment |
| Send a friend request | 1 | 5 | One award per unordered user pair |
| Accept a friend request | 2 | 5 | One award per unordered user pair |
| Add an avatar | 5 | one-time | One lifetime profile-completion award |
| Add a bio | 5 | one-time | One lifetime profile-completion award |
| Add a public social link | 5 | one-time | One lifetime profile-completion award |
| Use SourceBoard's share action on public content | 1 | 3 | One award per user + public target |

Accepted Source and Verified Source rewards continue to use the versioned reputation-rule system and are separate from the interaction rewards above.

## Abuse resistance

- Every award has a deterministic idempotency key. Retries do not create duplicate points.
- Likes on your own post or comment do not earn points.
- Unlike/re-like cycles cannot farm points because the actor/target award key is lifetime-stable.
- Removing and re-adding the same friend cannot farm request/accept rewards because the unordered user-pair key is stable.
- Avatar, bio and social-link completion rewards are one-time even if the field is later removed and restored.
- Post and comment creation rewards are reversed if that content is deleted.
- Daily caps limit high-volume interaction rewards even when every target is unique.
- Share points represent a bounded **share intent** only. SourceBoard does not claim that an external share was published or viewed. The server only accepts eligible public SourceBoard targets.
- Existing API rate limits remain the first line of defense against automated high-frequency posting, commenting and reacting.

## Ledger behavior

Contribution awards use the same `point_ledger` as Store balances and source-resolution rewards. Awards are written with `entry_type = AWARD`, deletions use append-only `REVERSAL` entries, and Store purchases continue to debit the resulting balance through their existing ledger path. Historical rows are not edited in place.

Administrative adjustments remain capability-gated and audited. Reward values in this document describe the current interaction economy; Accepted Source and Verified Source values remain versioned through Admin Reputation rules.
