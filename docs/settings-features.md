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
38. Background image upload
39. Background visibility
40. Background blur

### Comfort and chat

41. Workspace typography (Premium)
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
57. Custom cursor toggle
58. Microphone check and processing
59. Manual monthly Premium request
60. Gift Premium to another member

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
58. Premium community supporter board
59. Expiring/revocable invite links
60. Configuration backup export

## Premium and moderation behavior

Premium costs $1.99 per month. Manual payment requires approval by the account whose immutable ID is configured as `KYRO_FOUNDER_USER_ID`. Approval adds 30 days, renewals extend remaining time, and grants/revocations are logged. No automatic payment processing or billing is enabled. Set `KYRO_PREMIUM_PAYMENT_INSTRUCTIONS` in Convex to provide the real manual payment instructions.

Active Premium enables 200 MB uploads, 4,000-character human messages, 5 MB decoration submissions, 10 bot applications, the workspace editor and 1440p/60 fps display-capture targets. Free accounts retain 10 MB uploads, 2,000-character messages, 2 MB decorations and 2 bot applications. Existing applications are retained when access expires. Screen capture targets are negotiated from a server-verified entitlement; actual resolution/frame rate depends on the browser, device, connection and LiveKit service.

Decoration submission requires a registered upload owned by the submitter and a confirmation of original authorship. Staff must assess the authorship claim during review; file ownership alone cannot prove that the artwork was created by its uploader. Staff cannot approve their own work. Only approved artwork appears in the public collection, and rejected or withdrawn artwork stops rendering when profiles refresh. PNG, WebP, GIF and AVIF are supported; SVG/video decorations are excluded.

Community decoration search and the staff review queue use pagination so every published item and submission remains reachable. Member submission history is paginated as well. Events return up to 100 per server and ticket views up to 300 records. These are bounded views, not unlimited collections.

## Validation

`npm run typecheck`, `npm run build`, `npm run test:features`, `npm run test:ui`, `npm run test:voice` and the existing Vitest suites cover build compatibility, Premium permissions and expiry, upload ownership and quotas, moderation state, private ticket access, event capacity, image galleries, retry/removal, object URL cleanup, settings persistence and responsive layouts. Browser checks use isolated fixtures and do not send messages or payments to live accounts.

## Premium HQ and supercharge perks

One active Premium contribution can support one server: 200 custom emoji slots, 50 MB member message uploads and a 128 kbps microphone audio target (normally 100 slots, 10 MB and 64 kbps). Transferring support moves the benefits. Existing emojis remain when support expires, but creating more obeys the lower cap. Larger server uploads cannot be claimed as personal profile assets or sent outside a supported server unless the sender has their own Premium entitlement.

Premium members receive a pink role and a private `#premium-chat` lounge in the official Kyro HQ. Lounge reads, search, polls, voice access and notification previews require current Premium or platform staff access. Free members upload files in HQ's `#media`; Premium and staff can upload across HQ. HQ polls require creator verification, Premium or staff access. These HQ policies do not restrict ordinary communities.

Premium badges may be hidden independently of paid benefits. Creator verification and bot directory submissions appear in an indexed, paginated staff queue, with Premium submissions first. Priority is set when submitting. Administrators still review ownership, identity or bot behavior, must provide feedback, and cannot review their own submission. Revised bot listing details require a new review. New directory listings remain private until approved.

Scheduled expiry invalidates live queries when a month ends. Renewals extend the current period and stale expiry jobs cannot revoke a renewal. Actual voice bitrate and capture quality depend on the browser, device, network and LiveKit service.
