# Kyro settings feature inventory

This release exposes at least 60 distinct controls and workflows in each settings experience. The inventory includes retained controls as well as additions; presets are counted as collections, not as hundreds of separate features.

## User settings

### Account and safety

1. Display name
2. Username
3. Email changes
4. Password changes
5. Email reveal
6. Copy email
7. Presence choice
8. Custom status
9. Account standing
10. Device session revocation

### Profile

11. Avatar upload and crop
12. Profile banner upload and crop
13. About me
14. Pronouns
15. Profile links
16. Community tag
17. Primary badge
18. 200 profile themes
19. 200 avatar frames
20. 200 avatar decorations

### Artwork and sound

21. 200 profile decorations
22. Community decoration collection
23. Original artwork submission
24. Static and animated artwork support
25. Submission status and staff feedback
26. Withdraw your artwork
27. Custom notification sound upload
28. Notification audio preview
29. Restore the default sound
30. Notification volume

### Workspace Studio (Premium)

31. Workspace background color
32. Panel color
33. Workspace accent
34. Workspace text color
35. Corner radius
36. Sidebar width
37. Panel transparency
38. Static or animated background upload with preview and a reduced-motion still frame (5 MB)
39. Background visibility
40. Background blur

### Comfort and chat

41. Workspace typography: 15 themes including 12 self-hosted gaming and creator fonts (Premium)
42. Workspace message spacing (Premium)
43. Workspace border weight (Premium)
44. Workspace shadows (Premium)
45. Workspace contrast (Premium)
46. Dark/light/system appearance
47. Compact layout
48. Message text size
49. Send on Enter
50. Typing privacy

### Audio, access and Premium

51. Image and GIF previews
52. Mention and reply sounds
53. Incoming call sounds
54. Unread DM bubbles
55. Reduced motion
56. Underlined links
57. Custom cursor toggle, 10 additional Premium cursor styles and owned PNG cursor uploads (64 × 64, 128 KB) with adjustable click point
58. Microphone check and processing
59. Redeem a founder-issued Premium code
60. Redeem a code as a Premium gift with evolving Gifter badges

## Server settings

### Identity

1. Server name
2. Server description
3. Server icon upload and crop
4. Server banner upload and crop
5. Welcome message
6. Server rules
7. Discoverability
8. Discovery tags
9. Community tag
10. Profile links

### Channels and expression

11. Custom invite name
12. Community accent
13. Community tint
14. Upload custom emoji
15. Remove custom emoji
16. Create text channels
17. Create voice channels
18. Create forum channels
19. Create categories
20. Reorder channels

### Permissions and people

21. Channel permission overrides
22. Role creation
23. Role names
24. Role colors
25. Role hierarchy ordering
26. Role permission editor
27. Member role assignment
28. Member search
29. Kick members
30. Ban members

### Safety and onboarding

31. Unban members
32. Timed community lockdown
33. Manual unlock
34. Verification age gate
35. Minimum account age for joining
36. Rules channel
37. Require join applications
38. Custom application questions
39. Review join applications
40. AutoMod enable/disable

### Moderation

41. Blocked-word list
42. Block external invites
43. Block external links
44. Mention ceiling
45. Block excessive caps
46. Block duplicate spam
47. AutoMod exempt roles
48. AutoMod exempt channels
49. Review member reports
50. Audit log

### Community tools

51. Schedule events with capacity and location
52. Event RSVP
53. Cancel events
54. Private support tickets
55. Ticket categories
56. Staff replies and ticket claim
57. Close and reopen tickets
58. Lobby activity and invite leaderboards
59. Expiring/revocable invite links
60. Configuration backup export

## Premium and moderation behavior

Premium costs $1.99 per month. Manual payments are arranged with adrianeosyne, who alone can issue single-use `KYRO-XXXX-XXXX-XXXX` codes for 30, 90, 180 or 365 days. Users redeem codes immediately without applying. Codes store hashes and suffixes; full codes appear only at generation. Renewals extend active time; expired memberships start a new streak. Founder grants and revocations remain audited. No automatic billing is enabled.

Active Premium enables 200 MB uploads, 4,000-character human messages, 5 MB decoration submissions, 10 bot applications, the workspace editor and 1440p/60 fps display-capture targets. Free accounts retain 10 MB uploads, 2,000-character messages, 2 MB decorations and 2 bot applications. Existing applications are retained when access expires. Screen capture targets are negotiated from a server-verified entitlement; actual resolution/frame rate depends on the browser, device, connection and LiveKit service.

Decoration submission requires a registered upload owned by the submitter and a confirmation of original authorship. Staff must assess the authorship claim during review; file ownership alone cannot prove that the artwork was created by its uploader. Staff cannot approve their own work. Only approved artwork appears in the public collection, and rejected or withdrawn artwork stops rendering when profiles refresh. PNG, WebP, GIF and AVIF are supported; SVG/video decorations are excluded.

Community decoration search and the staff review queue use pagination so every published item and submission remains reachable. Member submission history is paginated as well. Events return up to 100 per server and ticket views up to 300 records. These are bounded views, not unlimited collections.

## Validation

`npm run typecheck`, `npm run build`, `npm run test:features`, `npm run test:ui`, `npm run test:voice` and the existing Vitest suites cover build compatibility, Premium permissions and expiry, upload ownership and quotas, moderation state, private ticket access, event capacity, image galleries, retry/removal, object URL cleanup, settings persistence and responsive layouts. Browser checks use isolated fixtures and do not send messages or payments to live accounts.

## Premium HQ perks

Premium members receive a pink role and a private `#premium-chat` lounge in the official Kyro HQ. Lounge reads, search, polls, voice access and notification previews require current Premium or platform staff access. Free members upload files in HQ's `#media`; Premium and staff can upload across HQ. HQ polls require creator verification, Premium or staff access. These HQ policies do not restrict ordinary communities.

Premium badges may be hidden independently of paid benefits. Creator verification and bot directory submissions appear in an indexed, paginated staff queue, with Premium submissions first. Priority is set when submitting. Administrators still review ownership, identity or bot behavior, must provide feedback, and cannot review their own submission. Revised bot listing details require a new review. New directory listings remain private until approved.

Scheduled expiry invalidates live queries when a month ends. Renewals extend the current period and stale expiry jobs cannot revoke a renewal. Actual voice bitrate and capture quality depend on the browser, device, network and LiveKit service.

## Lobbies, milestones and offline access

Server Settings > Lobby lets owners enable a welcome page, choose stacked, two-column or spotlight layouts, set colors and links, and reorder up to 12 sections. Owners can also edit directly on the lobby page. Drag handles support touch; arrow buttons support keyboard ordering. All reads require server membership and only the owner may save or manage feed tokens.

Lobby boards show top levels, messages in the current UTC Monday-to-Monday week, and successful unique invites. Activity starts with new messages after rollout. Human messages award 10 XP at most once per minute within each server; bots do not earn XP. Rejoining the same server never credits another invite.

Outside apps can POST `title`, `text`, `source`, `clientId` and optional HTTPS `url` as JSON to the displayed lobby feed endpoint. Set `Authorization: Bearer <token>` on the app's server. Duplicate client IDs are idempotent. The feed accepts at most 30 new entries per hour; owner token rotation or disconnection invalidates the old token. Tokens are shown once and stored as hashes.

Premium badges evolve after 30, 90, 180, 365, 730, 1095 and 1825 continuous days. Prepaid duration does not skip elapsed-time milestones. Profile and name badges show the original Premium since date and current streak. Gifter tiers are earned after 1, 10, 25 and 50 completed code gifts. HQ OG roles sync to profile badges.

After the first online visit installs the service worker, failed offline navigations show a standalone Kyro page with retry and automatic reconnect. It needs no JavaScript bundles, fonts or API access. Chat backgrounds use the same uploaded image and motion-safe still frame as Workspace Studio.

2FA already provides 10 single-use backup codes. Lost-phone recovery requires password proof and a one-time emailed link that expires in 15 minutes, is bound to the current authenticator and signs out sessions after disabling it. Email hints use accounts saved on the current device. Google sign-in is excluded at the user's request.

## November 16 additions

Founder code tools support generating 1, 5, 10 or 20 codes at once. Each code grants the chosen 30, 90, 180 or 365-day membership. An optional 7, 30 or 90-day redemption window limits when unused codes can activate membership; it does not shorten membership already redeemed. Full codes appear only during generation and can be copied together. The paginated masked history supports status filters and searches by code-ending prefix, including records beyond the previous 100-code view.

Lobby owners can apply six color presets, duplicate sections and undo or redo the last 50 draft changes. Presets preserve content and links. Draft history resets on save or discard and stays isolated to each server. Live members see only saved changes.

Chat settings now include consecutive-message grouping, personal chat background visibility and device-default, 12-hour or 24-hour timestamps. These preferences save on the current device and are available to free and Premium members; background uploads still require Premium.

AutoMod offers Relaxed, Balanced and Strict presets. Presets preserve blocked words and role/channel exemptions, and remain drafts until Save AutoMod. Staff can discard a draft to restore the last saved configuration. Existing server permission checks and audit records apply.
