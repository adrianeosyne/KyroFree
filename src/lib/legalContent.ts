export type LegalSection = {
  heading: string;
  body: [string, string];
};

export type LegalPolicy = {
  slug: "terms" | "privacy" | "copyright";
  title: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL_UPDATED = {
  date: "2026-11-14",
  label: "November 14, 2026",
};

export const TERMS: LegalSection[] = [
  {
    heading: "Scope of the agreement",
    body: [
      "These terms apply to the Kyro website, desktop application, messaging features, communities and developer platform. By opening an account or using these services, you agree to the terms that apply to your use.",
      "The Privacy Policy explains information handling, and the Copyright Policy explains content rights. Read all three together; community-specific rules may add participation requirements but cannot override Kyro's platform rules or applicable law.",
    ],
  },
  {
    heading: "Free access and funding",
    body: [
      "Kyro is completely free. There are no paid plans, subscriptions, premium tiers or paywalled features, and Kyro will not charge for the features that exist today.",
      "Limited banner advertisements can support operating costs. Independent costs, such as your internet connection or a third-party service you choose to visit, remain arrangements between you and that provider.",
    ],
  },
  {
    heading: "Age and legal eligibility",
    body: [
      "You must be at least 13 years old, or the higher minimum age required in your country, to use Kyro. You must be legally able to accept these terms or have any permission that local law requires.",
      "If a parent or guardian must authorize your use, obtain that authorization before registering. An organization using Kyro should ensure that the person accepting terms has authority to act for it.",
    ],
  },
  {
    heading: "Registration information",
    body: [
      "Register with an email address you control and provide accurate information required to create your account. Keep your email current so recovery instructions and important account notices can reach you.",
      "Do not register using another person's email without authorization. If you lose access to your email, recovery may require additional verification and cannot be guaranteed solely from a display name.",
    ],
  },
  {
    heading: "Account credentials",
    body: [
      "Keep your password, session tokens and recovery codes confidential. You are responsible for access you authorize and should contact support promptly if you believe someone has accessed your account without permission.",
      "Choose a unique password and use available two-factor protection. Do not send credentials in a chat or support request; support can investigate an account issue without asking you to disclose your password.",
    ],
  },
  {
    heading: "Active sessions and shared devices",
    body: [
      "Signing in can keep a device connected until you sign out, revoke its session or the session expires. Review active devices in account settings and remove access you no longer recognize or need.",
      "On a borrowed computer, sign out when finished and remove any locally saved account information. Closing a browser window alone may leave your account accessible to the next person using that device.",
    ],
  },
  {
    heading: "Usernames and account identity",
    body: [
      "Usernames are unique identifiers and are subject to availability, naming restrictions and change limits. Kyro may reserve or reclaim handles that violate its rules, create misleading identity claims or belong to abandoned accounts.",
      "A familiar name or badge does not prove that an account represents an organization. Clearly identify unofficial fan or parody profiles when people could otherwise mistake them for an official account.",
    ],
  },
  {
    heading: "Profile customization",
    body: [
      "You can customize available profile fields, avatars, banners and appearance options. The information and images you select must comply with platform rules and the rights of their owners.",
      "Profile visibility depends on how Kyro displays accounts across conversations and communities. Avoid publishing information you intend to keep confidential in a field that other users can view.",
    ],
  },
  {
    heading: "Acceptable participation",
    body: [
      "Use Kyro lawfully and respectfully. Do not distribute unlawful material, impersonate others, send unsolicited spam, upload malware or disrupt communities. Content, messages and account behavior must follow Kyro's rules and the legitimate participation rules of communities you join.",
      "A community's approval does not authorize conduct prohibited by Kyro. You can use reporting tools when you believe a member, moderator or community is using the service inappropriately.",
    ],
  },
  {
    heading: "Community rules",
    body: [
      "Community owners may establish additional rules for topics, posting formats, membership and moderation. Joining a community means following its published rules while you participate there.",
      "Read welcome messages and channel instructions before posting. If the rules do not suit your needs, you can leave; a disagreement with a community rule does not authorize bypassing its access restrictions.",
    ],
  },
  {
    heading: "Community ownership",
    body: [
      "Owners are responsible for configuring their communities and choosing who can administer them. Ownership provides management capabilities, but does not transfer ownership of members' accounts or original contributions.",
      "Grant administrative access carefully and keep community rules understandable. Before transferring ownership, confirm the recipient and consider how the transfer will affect permissions, integrations and existing members.",
    ],
  },
  {
    heading: "Roles and permissions",
    body: [
      "Roles and channel overrides determine who can view, post, manage content and use other community features. Respect those boundaries and do not attempt to obtain access that an owner has restricted.",
      "An owner should grant only the capabilities each member or bot needs. A management permission authorizes a platform action; it does not authorize using that action contrary to these terms.",
    ],
  },
  {
    heading: "Invitations and discovery",
    body: [
      "Invites and directory listings help people find communities. Only share invitations you are authorized to distribute, and describe the destination accurately when promoting a server.",
      "An invite can be disabled, expire or stop working when access conditions change. A listing in discovery does not mean Kyro endorses every member, message or external service associated with that community.",
    ],
  },
  {
    heading: "Direct messages and friend requests",
    body: [
      "Messaging and friend requests are subject to account privacy preferences, blocks and other restrictions. Respect another person's decision to decline a request or end a conversation.",
      "Sharing a server does not guarantee that its members accept direct messages. Use the available privacy and blocking controls to manage contact, and reporting tools for conduct that needs review.",
    ],
  },
  {
    heading: "Posting and editing content",
    body: [
      "You are responsible for the text, links, files and other contributions you choose to post. Review your audience and content before sending, and correct mistakes with the available editing or deletion tools.",
      "Editing a message changes what Kyro displays, but recipients may already have read or copied an earlier version. Deleting a contribution cannot remove independent screenshots, downloads or quotations made by others.",
    ],
  },
  {
    heading: "Ownership of your contributions",
    body: [
      "You retain any intellectual property rights you hold in your original contributions. Posting on Kyro does not transfer ownership to Kyro, community owners or the people who view your content.",
      "You must have the necessary rights or legal basis to share material belonging to someone else. Giving credit can be useful, but credit alone does not replace a required license or permission.",
    ],
  },
  {
    heading: "Permission to operate the service",
    body: [
      "You grant Kyro a non-exclusive permission to store, transmit, display and technically process the content you submit as needed to operate the service. This permission supports delivery to the audience you select.",
      "For example, Kyro needs to store a message and present it to authorized channel members. This operating permission is not a blanket right for other users to sell or republish your work.",
    ],
  },
  {
    heading: "Files and upload restrictions",
    body: [
      "Uploads are subject to supported formats, size limits, verification and access controls. Kyro may reject or restrict files that fail validation or violate platform rules or another person's rights.",
      "A successful upload does not certify a file's accuracy, ownership or suitability for every device. Keep your own originals and review the permissions of the channel or conversation where you attach a file.",
    ],
  },
  {
    heading: "Calls, video and screen sharing",
    body: [
      "Live communication depends on device permissions, community access rules and service availability. You control whether to enable your microphone, camera or supported screen sharing features.",
      "Check the selected screen or window before sharing, and obtain any consent required before recording another participant. Other participants may use their own recording tools, so choose your audience thoughtfully.",
    ],
  },
  {
    heading: "Notifications and account emails",
    body: [
      "Kyro can send in-app notifications and transactional emails relating to access, recovery, security or account actions. Notification settings control supported alerts, but essential account communications may still be necessary.",
      "Delivery depends on device settings, connectivity and email providers. Do not rely on a notification as proof that someone has read a message or that an urgent request has reached them.",
    ],
  },
  {
    heading: "Bots and independent integrations",
    body: [
      "Bots may provide commands, automation and services inside communities. An independent bot is operated by its developer, and its own terms and privacy information may apply to information you give it.",
      "Review installation permissions and developer information before enabling a bot. Removing an installation can stop future authorized access, but does not automatically erase information the developer already received.",
    ],
  },
  {
    heading: "Developer responsibilities",
    body: [
      "Developers must protect bot credentials, accurately describe their applications and request only necessary permissions. Integration behavior must comply with these terms and respect community settings and user choices.",
      "Provide meaningful support and privacy information for users of your bot. If a token is exposed, rotate or revoke it promptly rather than assuming that removing it from a message eliminates the exposure.",
    ],
  },
  {
    heading: "API limits and platform integrity",
    body: [
      "Use documented developer interfaces within their access and rate limits. Do not circumvent permission checks, impersonate accounts or use automated requests to interfere with service availability.",
      "Kyro may limit or revoke access that exceeds allowed use or creates operational problems. Report suspected technical issues to support with enough information to investigate, without exposing other users' private data.",
    ],
  },
  {
    heading: "External links and services",
    body: [
      "Messages, profiles, advertisements and integrations can lead to services outside Kyro. Those providers control their own content, availability, prices, terms and privacy practices.",
      "Review the destination before signing in or supplying information. A link appearing on Kyro does not make the linked service part of Kyro or guarantee the accuracy of its claims.",
    ],
  },
  {
    heading: "Advertising placements",
    body: [
      "Where enabled, clearly identified banner advertisements help fund the free service. Advertising providers may handle device and request information as explained in the Privacy Policy and their own policies.",
      "An advertisement is separate from Kyro's community content and does not represent an endorsement. Any purchase or account you create with an advertiser is an arrangement with that advertiser.",
    ],
  },
  {
    heading: "Moderation and platform enforcement",
    body: [
      "Kyro may restrict content, features, accounts or integrations that breach its terms or applicable law. Community moderators may also enforce their own rules using the permissions granted to them.",
      "The action taken can depend on context, severity and repeated behavior. Where appropriate and feasible, Kyro will explain an account action; some details may be limited to protect privacy or an ongoing investigation.",
    ],
  },
  {
    heading: "Reports and supporting information",
    body: [
      "Use reporting tools or support to raise a specific concern. Provide relevant message links, account or community identifiers and a concise explanation so the issue can be located and assessed.",
      "Submit reports honestly and avoid unnecessary personal information about others. A report starts a review; it does not guarantee a particular outcome or give the reporter access to another person's private records.",
    ],
  },
  {
    heading: "Requests to review an action",
    body: [
      "If you believe a Kyro enforcement action was mistaken, contact support with the affected account, the notice you received and information that explains the issue. Kyro can assess requests within its control.",
      "For a community-specific decision, begin with that community's authorized moderators where possible. Kyro may review platform-rule concerns, but is not required to reverse every local membership decision.",
    ],
  },
  {
    heading: "Privacy choices",
    body: [
      "The Privacy Policy describes what information Kyro uses and what controls are available. Settings can help manage direct messages, friend requests, presence, suggestions and other supported preferences.",
      "Your choices affect future behavior within the supported feature. For example, hiding presence does not delete messages you already posted, and blocking an account cannot erase copies of earlier conversations.",
    ],
  },
  {
    heading: "Data exports",
    body: [
      "Account settings provide an export of selected account information and content. An export is intended to help you access your information; it is not a complete backup of every community or third-party record.",
      "Large histories and certain record types can fall outside the self-service export. Contact support if you need information that is missing, and protect downloaded exports because they may contain personal details.",
    ],
  },
  {
    heading: "Leaving and deleting an account",
    body: [
      "You can stop using Kyro or request account deletion in settings. Before deleting an account, you must transfer or delete communities you own, and should save information you want to keep.",
      "Deletion removes the account and supported associated records from active use. Some content, separate records, backups or third-party copies may require additional handling; the Privacy Policy explains these limits.",
    ],
  },
  {
    heading: "Suspension and termination",
    body: [
      "Kyro may suspend or terminate access for a breach of these terms, legal requirements or serious operational concerns. Depending on the situation, action may apply to an account, community, application or particular feature.",
      "A terminated account does not authorize creating another account to bypass the action. Terms relating to existing obligations, content rights and unresolved disputes continue where their nature requires it and law permits.",
    ],
  },
  {
    heading: "Availability and maintenance",
    body: [
      "Kyro aims to keep communication available, but interruptions can occur during maintenance, outages, provider problems or changes to the service. Continuous availability and delivery at a specific time are not guaranteed.",
      "Keep independent copies of information you cannot afford to lose. Calls, notifications and uploads may be affected by your device or network even when the Kyro service itself is operating.",
    ],
  },
  {
    heading: "Feature changes and compatibility",
    body: [
      "Features and supported devices may change as Kyro develops. Some functions depend on browser capabilities, device permissions, operating-system support or an external provider's continued availability.",
      "Keep the application and browser current to receive supported improvements. A feature available on one device may work differently on another, especially for media capture, notifications and screen sharing.",
    ],
  },
  {
    heading: "No guaranteed outcome",
    body: [
      "To the extent allowed by law, Kyro is provided as-is and as available, without a guarantee that every feature will be uninterrupted, error-free or suitable for a particular purpose.",
      "Content from members and independent services may be incomplete or inaccurate. Evaluate information before relying on it; nothing here excludes a warranty or protection that applicable law does not allow Kyro to exclude.",
    ],
  },
  {
    heading: "Limits on liability",
    body: [
      "To the extent permitted by law, Kyro is not liable for indirect or consequential losses arising from use of the service, including losses resulting from interruptions or independent third-party conduct.",
      "This limitation applies only where legally valid. It does not remove mandatory consumer protections or exclude liability that applicable law requires Kyro to accept.",
    ],
  },
  {
    heading: "Applicable law and user protections",
    body: [
      "Use of Kyro must comply with laws applicable to you and the service. These terms do not take away mandatory rights relating to consumer protection, privacy, intellectual property or access to legal remedies.",
      "Contact support first if an issue can be resolved practically. This page does not require private arbitration or designate a particular country's courts; any dispute remains subject to the rules that legally apply.",
    ],
  },
  {
    heading: "Reading and enforcing the agreement",
    body: [
      "If a provision cannot lawfully be enforced, the remaining provisions continue to apply to the extent permitted by law. Kyro's decision not to enforce a rule on one occasion does not waive it for future situations.",
      "These terms and the referenced policies describe the platform agreement. A user, moderator or independent developer cannot change Kyro's obligations merely by posting their own interpretation in a community.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "The last-updated date identifies the current version of these terms. Material changes will be surfaced in the product or on this page, with additional notice or consent where applicable law requires it.",
      "Review updates before continuing to use the affected service. Continuing after an update takes effect indicates acceptance where legally valid; you can stop using Kyro if you do not agree.",
    ],
  },
  {
    heading: "Contact and policy questions",
    body: [
      "Contact support@kyro-chat.cyou for questions about these terms, account access or a platform decision. You can also use available in-app reporting and support options for issues connected to particular content.",
      "Include your username, the relevant feature and a short description. Do not include passwords, session tokens or recovery codes; if more information is needed, support can explain what is relevant.",
    ],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    heading: "Scope of this policy",
    body: [
      "This policy describes information handled when you use Kyro's website, desktop app, communities, messaging and developer features. It explains the main data categories, purposes, recipients and choices associated with the service.",
      "Independent communities, bots and external websites may handle their own copies of information under their own policies. Review those policies before sharing information outside the controls Kyro provides.",
    ],
  },
  {
    heading: "Who handles your information",
    body: [
      "Kyro is responsible for the personal information it handles to operate its own service. Questions and privacy requests can be sent to support@kyro-chat.cyou, identifying that your request concerns privacy.",
      "A community owner or independent developer can also make separate decisions about information they receive. Contact that operator for their records; Kyro support can address information and access within Kyro's control.",
    ],
  },
  {
    heading: "Account and registration data",
    body: [
      "Kyro stores the email address used for your account, your username and the account records needed for registration and sign-in. Account timestamps help manage creation, changes and related operations.",
      "Your account email is used for account functions rather than displayed as a normal public profile field. If you post it in a message or biography, it becomes visible to that content's audience.",
    ],
  },
  {
    heading: "Authentication and security records",
    body: [
      "Authentication uses protected credential records, sessions and tokens. When enabled, two-factor security also uses records needed to validate codes and manage recovery, rather than making those secrets part of your public profile.",
      "These records keep accounts accessible to authorized users and support recovery and session revocation. Protect your own credentials and contact support about unfamiliar access without sending passwords or recovery codes.",
    ],
  },
  {
    heading: "Profile information",
    body: [
      "Kyro stores the display name, avatar, banner, biography, custom status and other supported profile choices you supply. These fields help people identify accounts and customize the community experience.",
      "Other users may see profile information in conversations, member lists, suggestions or profile views. Publish only information you are comfortable making visible in those contexts, and update fields through settings.",
    ],
  },
  {
    heading: "Settings and appearance preferences",
    body: [
      "Kyro uses account settings and local preferences for privacy, themes, colors, notification behavior and other supported options. Some preferences are stored on your device, while others are stored with your account.",
      "A local preference may differ between devices and can disappear when browser data is cleared. Account settings generally continue to apply when you sign in elsewhere, subject to the feature's design.",
    ],
  },
  {
    heading: "Messages and conversation content",
    body: [
      "Kyro stores message text, replies, edits, reactions and related identifiers so conversations can be delivered and displayed. Messages are associated with their author, conversation or channel and relevant timestamps.",
      "Direct messages have an intended participant audience, while community content depends on channel permissions. Kyro does not promise end-to-end encryption; service-side processing and authorized access can be needed for delivery, support and enforcement.",
    ],
  },
  {
    heading: "Uploads and attachments",
    body: [
      "Uploaded files and images are stored with information needed to validate them, associate them with their owner and control supported access. This can include names, sizes, file types and verification information.",
      "A file can contain personal information beyond its visible preview, including embedded metadata. Review files before uploading; copies downloaded by another person are outside Kyro's ability to recall.",
    ],
  },
  {
    heading: "Community membership and roles",
    body: [
      "Kyro stores community memberships, roles, nicknames, invitations and related access records. These determine which spaces you can enter and what actions you can perform there.",
      "Owners and authorized moderators can view membership information needed to manage their communities. Leaving a server changes membership access, but does not automatically erase every contribution or moderation record connected to it.",
    ],
  },
  {
    heading: "Friends, requests and blocks",
    body: [
      "Friend relationships, pending requests and blocking records support contact controls and social features. Shared-community relationships can also be used to generate supported suggestions unless you disable being suggested.",
      "Blocking restricts supported direct contact, but people may still encounter content in shared spaces. Changing a relationship does not delete earlier messages or copies a recipient already saved.",
    ],
  },
  {
    heading: "Presence and activity signals",
    body: [
      "Presence status, recent activity timestamps and typing or participation signals help display who is available and what is happening in a conversation. Visibility depends on account preferences and the feature involved.",
      "You can hide supported presence indicators, including through invisible mode. This changes what other people see; the service can still process the connection information needed to keep your session working.",
    ],
  },
  {
    heading: "Read state and notifications",
    body: [
      "Read cursors, notification records and channel notification preferences help count unread items and deliver supported alerts. Notification content can include message previews or information about a community action.",
      "Device notifications may appear on a lock screen or shared display depending on operating-system settings. Adjust both Kyro preferences and device-level preview settings if you want to limit visible notification content.",
    ],
  },
  {
    heading: "Technical and operational information",
    body: [
      "Requests to Kyro and its infrastructure providers can involve IP addresses, browser or device details, timestamps and error information. Operational records support connectivity, troubleshooting, rate limiting and service security.",
      "The exact records depend on the feature and configured provider. Diagnostic information should be limited to the issue being investigated; avoid placing private content or credentials in a bug report when they are unnecessary.",
    ],
  },
  {
    heading: "Moderation and audit records",
    body: [
      "Reports, warnings, enforcement cases, automated moderation events and audit logs can include affected account identifiers, relevant content and action timestamps. Kyro and authorized community staff use these records to review issues and manage access.",
      "Access varies by role and whether an issue concerns a community or the platform. Records may need to remain available after a message is removed to explain an action or resolve a dispute.",
    ],
  },
  {
    heading: "Support communications",
    body: [
      "When you contact support or submit a bug report, Kyro receives your contact details and the information you include. This may contain screenshots, affected account identifiers and a description of the problem.",
      "Support uses that information to investigate and respond. Send only relevant details, remove unrelated personal information from screenshots and never include a password, authentication token or recovery code.",
    ],
  },
  {
    heading: "Email delivery and account notices",
    body: [
      "Verification, password recovery, security and account notices can require your email address, message content and delivery status to be handled by Kyro's email infrastructure and configured mail provider.",
      "Delivery records help diagnose failures and prevent repeated or inappropriate requests. Supported notification choices do not necessarily disable essential messages required for account access, security or a legal notice.",
    ],
  },
  {
    heading: "Live audio, video and screen sharing",
    body: [
      "LiveKit carries live audio, video and shared-screen media for Kyro calls. Kyro handles permissions, room and participant identifiers, connection state and call records needed to authorize and coordinate those sessions.",
      "Microphone, camera and screen access depend on your device permissions and actions. Check your selected screen before sharing and stop the relevant track or leave the call when you want transmission to end.",
    ],
  },
  {
    heading: "Voice messages and participant recordings",
    body: [
      "A voice message you record and send becomes an uploaded attachment associated with the conversation. It is handled as stored content rather than as a temporary live call.",
      "A participant may separately record a live conversation using their own tools. Kyro cannot guarantee control over those independent copies; agree on recording expectations and obtain consent where the law requires it.",
    ],
  },
  {
    heading: "Bots and information sent to developers",
    body: [
      "Installed bots may receive commands, interaction details, permitted messages and subscribed events according to their permissions. Data delivered to a bot can be processed on systems controlled by its developer.",
      "Review the bot's permissions and privacy URL before using it. Uninstalling or revoking permissions restricts future access, while deletion of data already held by the developer may require a separate request to that developer.",
    ],
  },
  {
    heading: "Developer platform records",
    body: [
      "Application ownership, installation grants, token-management records, API activity, gateway sessions and event-delivery logs support the developer platform. Usage summaries and audit records help developers and authorized staff diagnose application behavior.",
      "These records are distinct from a public profile and have access restrictions. Delivery events can contain permitted community information, so developers must protect their endpoints and avoid retaining unnecessary copies.",
    ],
  },
  {
    heading: "GIF search and external media",
    body: [
      "When configured, KLIPY receives GIF search text, locale, a Kyro account identifier and selected GIF share events through the integration. Loading remotely hosted GIFs or other external media can also disclose request and device information to their hosts.",
      "Those providers process requests under their own policies. Avoid including sensitive information in a GIF search, and remember that a third-party media request is separate from storing a normal Kyro message.",
    ],
  },
  {
    heading: "Cookies, local storage and caches",
    body: [
      "Kyro and its providers use authentication storage, local preferences and caches to keep the app usable. Your device may retain drafts, remembered account details, interface choices and cached application resources.",
      "Browser controls can clear this storage, but doing so may sign you out or remove local drafts and preferences. Clearing device storage does not itself delete the corresponding account or messages stored by Kyro.",
    ],
  },
  {
    heading: "Advertising information",
    body: [
      "Where a Google AdSense banner is enabled, Google may receive your IP address, browser and device information, cookie identifiers and available consent signals to serve, protect and measure advertisements.",
      "Kyro does not sell private messages or read them to build advertising profiles. Advertising requests remain subject to Google's processing and applicable law; they are separate from ordinary message delivery.",
    ],
  },
  {
    heading: "Advertising choices",
    body: [
      "Advertising consent requirements and available controls depend on your region and the provider. Non-essential advertising storage or personalization must have consent where applicable law requires it.",
      "Use available provider consent options, browser cookie controls and Google's advertising settings to manage supported choices. This policy does not claim that every ad preference is available as a dedicated Kyro account setting.",
    ],
  },
  {
    heading: "Purposes for using information",
    body: [
      "Kyro uses information to create accounts, deliver conversations, apply permissions, coordinate calls, support communities and operate integrations. It also uses relevant records to maintain reliability, handle support and investigate platform issues.",
      "Limited advertising supports the free service. Different purposes require different information: delivering a direct message needs its content and audience, while a theme preference helps display the interface you selected.",
    ],
  },
  {
    heading: "Legal grounds for processing",
    body: [
      "Where privacy law requires a legal basis, processing can rely on providing the requested service, legitimate interests such as security and reliability, legal obligations or consent for activities that require it.",
      "The relevant basis depends on the purpose and your jurisdiction. You can ask support about a particular activity, and withdraw consent where that is the basis without changing the legality of earlier processing.",
    ],
  },
  {
    heading: "Information visible to other users",
    body: [
      "Other users receive content you share with them and profile or participation information the feature makes visible. Community moderators can access permitted channel and membership information needed for their role.",
      "A recipient may copy, quote or download content. Changing visibility later can restrict future access within Kyro, but does not guarantee deletion of information someone legitimately received earlier.",
    ],
  },
  {
    heading: "Infrastructure and service providers",
    body: [
      "Kyro uses Convex for backend records and file storage, Vercel for web hosting and API functions, LiveKit for live media and configured mail providers for email delivery. Each receives information needed for its role.",
      "Other enabled services, including KLIPY and Google advertising, are described above. Providers may maintain their own operational records, and their services can involve separate privacy terms and legal obligations.",
    ],
  },
  {
    heading: "Legal and protective disclosures",
    body: [
      "Kyro may disclose relevant information when legally required, to respond to valid legal process or to protect rights and service security where law permits. Requests should be assessed for their legal basis and appropriate scope.",
      "A request from another user does not automatically entitle them to private account information. Notice may be provided where appropriate, unless prohibited by law or incompatible with a legitimate investigation.",
    ],
  },
  {
    heading: "International processing",
    body: [
      "Kyro's providers and participants may be located in countries different from yours. Using hosted infrastructure or sending content to a person abroad can therefore involve cross-border processing.",
      "Where transfer safeguards are required, the relevant processing must comply with those requirements. Contact support if you need information about the providers or safeguards associated with a particular privacy request.",
    ],
  },
  {
    heading: "How long information is kept",
    body: [
      "Account and content records are generally kept while needed to provide the service or maintain the relevant community. Security, delivery, support and enforcement records can have different lifetimes based on their purpose and applicable obligations.",
      "This policy does not promise one fixed retention period for every record. Information should not be kept longer than its legitimate purpose requires; ask support about a particular category if its retention matters to your request.",
    ],
  },
  {
    heading: "Account deletion",
    body: [
      "Account settings let you permanently delete your account after transferring or deleting communities you own. The process removes the account, sessions and supported related records, including messages handled by the deletion operation.",
      "Current self-service message deletion processes up to 5,000 authored messages. Larger histories, separate content types or remaining file records may need additional assistance; contact support about anything that remains rather than assuming all copies disappeared.",
    ],
  },
  {
    heading: "Remaining records and independent copies",
    body: [
      "Some information can remain in backups, audit or legal records, separate community content, device storage or copies held by recipients and independent developers. Removing an account is not a remote deletion instruction for those systems.",
      "Kyro cannot promise instant deletion from every provider backup or another person's download. Ask support about records under Kyro's control, clear your own device storage if needed and contact independent operators about their copies.",
    ],
  },
  {
    heading: "Access and data portability",
    body: [
      "You can download a self-service export from account settings. It includes selected profile, relationship, community, message, notification and security-summary information; the current export includes up to 5,000 messages and 1,000 notifications.",
      "The export does not necessarily contain every attachment or record type. Contact support for a broader access or portability request where applicable, and store exported files securely because they can reveal personal information.",
    ],
  },
  {
    heading: "Correcting your information",
    body: [
      "You can update supported profile and account fields in settings, subject to security checks and change limits. If inaccurate information cannot be changed directly, contact support with the correction you are requesting.",
      "Some historical records describe what happened at a particular time and may need an annotation rather than replacement. Kyro may verify identity before changing account information to avoid giving control to an unauthorized requester.",
    ],
  },
  {
    heading: "Objections, restrictions and complaints",
    body: [
      "Depending on your location, you may have rights to object to certain processing, request restrictions or seek deletion beyond self-service controls. You may also be entitled to complain to your local privacy regulator.",
      "Send requests to support with the activity and outcome you want reviewed. Rights can have lawful limits, including protecting other people's information or retaining records required by law; any applicable refusal should be explained.",
    ],
  },
  {
    heading: "Consent and device permissions",
    body: [
      "You can withdraw consent for processing that relies on it and revoke microphone, camera or notification permissions through supported provider and device controls. Revocation changes future use of that permission.",
      "Previously sent messages or recordings remain subject to their normal handling until separately deleted. Some features cannot function without necessary permissions, such as video transmission when camera access is disabled.",
    ],
  },
  {
    heading: "Security and its limits",
    body: [
      "Kyro uses authentication, permission checks, restricted credentials and upload validation to reduce unauthorized access. Provider infrastructure and protected connections also support the operation of the service.",
      "No system can guarantee absolute security. Protect your devices and account, review active sessions and report suspected exposure promptly; do not treat a private channel as a guarantee that recipients cannot copy its contents.",
    ],
  },
  {
    heading: "Age requirements and privacy",
    body: [
      "Kyro is intended for people who meet the minimum age in the Terms of Service: at least 13, or a higher minimum required locally. Required parent or guardian permissions must also be obtained where applicable.",
      "Contact support if you believe an account does not meet those requirements or you need to raise a related privacy request. Provide only the information necessary to locate the account and explain the concern.",
    ],
  },
  {
    heading: "Policy updates and privacy contact",
    body: [
      "The last-updated date identifies this version of the policy. Kyro will surface material changes on this page or in the product and provide any additional notice or consent required by applicable law.",
      "Send privacy questions and requests to support@kyro-chat.cyou. Describe the relevant account and data category; support may request proportionate identity verification, but you should never send passwords or recovery codes.",
    ],
  },
];

export const COPYRIGHT: LegalSection[] = [
  {
    heading: "Purpose of this policy",
    body: [
      "This policy explains ownership, permission and copyright-related reporting for content shared through Kyro. It applies to messages, uploads, profile images, community assets and material distributed by bots or integrations.",
      "Read it with the Terms of Service and Privacy Policy. Copyright law varies by location, so a permission or exception must cover your particular use rather than simply exist somewhere else.",
    ],
  },
  {
    heading: "What copyright protects",
    body: [
      "Copyright generally protects original expression, such as writing, photographs, illustrations, music, videos and software. It can protect a work without a visible copyright notice or registration, depending on applicable law.",
      "An idea, fact or short phrase is not necessarily protected in the same way as a finished creative work. Other rights may still apply, so check the material and intended use rather than relying on a broad assumption.",
    ],
  },
  {
    heading: "Ownership of member content",
    body: [
      "Members retain the rights they hold in their original contributions. Posting on Kyro does not transfer those rights to Kyro, the community owner or the people who read a message.",
      "If you created a drawing, others may view it in the channel you selected, but that does not automatically let them sell prints or publish it elsewhere. Separate permission may be required.",
    ],
  },
  {
    heading: "Kyro's own materials",
    body: [
      "Kyro's original website copy, visual assets and application materials are protected to the extent applicable law provides. Copyright in third-party components and member contributions remains with their respective rights holders.",
      "A Kyro copyright notice does not claim ownership of everything visible on the platform. Any separately published software or asset license determines the permissions available for that particular material.",
    ],
  },
  {
    heading: "Names, logos and trademarks",
    body: [
      "Names and logos can involve trademark rights as well as copyright. Do not use Kyro branding or another organization's marks in a way that falsely implies sponsorship, partnership or official account status.",
      "A factual reference to a service can be different from branding your own product as that service. If your use would make people believe your community or bot is official, obtain authorization or change the presentation.",
    ],
  },
  {
    heading: "Open-source components",
    body: [
      "Software and assets made available under an open-source license remain governed by that license. Permission can depend on preserving notices, including a license copy or satisfying other conditions.",
      "Do not assume that visible source code means unrestricted use. Check the license for the specific component and version, especially before redistribution or incorporation into another application.",
    ],
  },
  {
    heading: "Public access is not public domain",
    body: [
      "A work being accessible on a website, social account or public Kyro channel does not mean it is in the public domain. Public viewing and permission to reproduce are different questions.",
      "Before uploading someone else's material, locate its license or ask its owner. A download button, search result or absence of a watermark is not enough to establish a right to reuse it.",
    ],
  },
  {
    heading: "Sharing work you created",
    body: [
      "You may share your own work when you have the rights needed for the intended use. Employment contracts, commissioned projects or previous assignments can affect who owns a particular work.",
      "For example, a file you made for an employer may belong to that employer under the applicable agreement or law. Check those obligations before treating every file you personally created as yours to publish.",
    ],
  },
  {
    heading: "Permission from a rights holder",
    body: [
      "Permission should cover what you plan to do: upload, display, edit, distribute or reuse a work in a bot or community. The person granting permission must be entitled to authorize that use.",
      "Keep a record of the permission and any limits, such as audience, duration or required credit. Permission to post in one group does not automatically extend to advertising or distribution through an unrelated service.",
    ],
  },
  {
    heading: "Creative Commons and similar licenses",
    body: [
      "Creative Commons and other public licenses allow specified uses subject to their terms. Requirements may include attribution, a license link, identifying changes, limiting commercial use or sharing adaptations under compatible terms.",
      "Read the exact license rather than relying on an 'available for use' label. A license that allows sharing an unchanged image may still restrict editing it or using it in a commercial promotion.",
    ],
  },
  {
    heading: "Attribution and credits",
    body: [
      "Credit the creator when a license or permission requires it, and make the credit understandable and accessible with the work. Preserve required copyright and license notices when redistributing permitted material.",
      "Attribution helps identify the source, but does not create permission by itself. Writing 'credit to the owner' or 'no infringement intended' cannot substitute for a license or applicable legal exception.",
    ],
  },
  {
    heading: "Public-domain material",
    body: [
      "Public-domain works may be reusable without copyright permission, but status depends on the work and jurisdiction. A newer translation, recording, photograph or edition can carry rights separate from the underlying work.",
      "Check the source and the version you plan to share. An old musical composition might be public domain while a recent performance of that composition remains protected.",
    ],
  },
  {
    heading: "Fair use and other legal exceptions",
    body: [
      "Some laws allow limited use for purposes such as criticism, commentary, quotation or education. Whether an exception applies depends on the jurisdiction and facts, including the amount used and the effect on the original work.",
      "A label such as 'educational' does not automatically settle the question. Use only what is appropriate for the purpose and consider permission when an exception is uncertain or the use goes beyond it.",
    ],
  },
  {
    heading: "Quotations and excerpts",
    body: [
      "A short excerpt used in genuine discussion may be treated differently from reposting an entire work. Any quotation must still satisfy the applicable permission, license or legal exception.",
      "Use the portion necessary to make your point, identify its source and avoid replacing access to the original. There is no universal word count or percentage that makes every quotation lawful.",
    ],
  },
  {
    heading: "Links to original sources",
    body: [
      "Linking to an authorized source can let people access material without uploading a new copy to Kyro. The destination and context still matter, particularly when the linked material was distributed without permission.",
      "Prefer the creator's own page or an authorized publisher. A link should not be used to avoid a removal decision by repeatedly directing people to the same unauthorized copy elsewhere.",
    ],
  },
  {
    heading: "Embeds and previews",
    body: [
      "A preview, thumbnail or embedded player does not grant a general license to download or republish the underlying work. Provider terms and the rights associated with the displayed material continue to apply.",
      "If you need to reuse an image shown in a preview, check its source and permission separately. Technical support for displaying media is not a determination that every possible use is authorized.",
    ],
  },
  {
    heading: "Music and audio",
    body: [
      "Music can involve separate rights in a composition, lyrics and a particular recording. Sharing a song file, recording a performance or broadcasting music may require permissions covering more than one rights holder.",
      "Buying a track or subscribing to a streaming service usually gives listening access under that provider's terms. It does not automatically authorize uploading the track or using it in a community broadcast.",
    ],
  },
  {
    heading: "Film, television and video",
    body: [
      "Video content can contain protected footage, soundtracks, scripts and graphics. Sharing a clip or recording is subject to the rights and exceptions that apply to those elements and your intended use.",
      "Access to a movie or subscription service does not itself grant redistribution rights. For commentary, use appropriately limited excerpts when legally permitted rather than assuming a full repost is covered.",
    ],
  },
  {
    heading: "Images, artwork and photography",
    body: [
      "Photographs, illustrations, screenshots and other images may contain protected expression. Cropping, resizing or removing a watermark does not eliminate the rights in the original work.",
      "Check image licenses before using artwork as an avatar, banner or community icon. A person depicted in an image may also have privacy or publicity rights separate from the photographer's copyright.",
    ],
  },
  {
    heading: "Software, code and digital resources",
    body: [
      "Code, packaged applications, game assets and other digital resources can be protected and licensed for specific uses. Redistribution must comply with the relevant license and any required notices.",
      "A code snippet found in a repository may have different permissions from a forum example. Verify the source and license before distributing it through messages, downloads, templates or a bot.",
    ],
  },
  {
    heading: "Fonts and design assets",
    body: [
      "Fonts, icon sets, design templates and stock assets often have licenses tied to how they are used or distributed. Permission to produce a finished design may not include permission to share the underlying asset file.",
      "Before uploading a font or editable design pack, check whether redistribution is allowed. Preserve required notices and do not assume that a license for one project covers every community member's separate use.",
    ],
  },
  {
    heading: "Custom emoji, stickers and GIFs",
    body: [
      "Custom emoji, stickers and GIFs remain subject to the rights in their artwork or footage. Uploading a small or animated version does not automatically remove copyright protection.",
      "Use original artwork, authorized assets or a valid legal basis. A provider making a GIF available in a picker does not give you unlimited rights to extract, sell or redistribute its underlying footage.",
    ],
  },
  {
    heading: "Templates and community resources",
    body: [
      "A server template or shared resource may contain original wording, images and other protected material. Its author can offer reuse permissions, but can only authorize rights they actually hold.",
      "State a clear license when sharing a resource you want others to reuse. Community structure or an idea alone may not carry the same protection as copied creative text or assets included in the template.",
    ],
  },
  {
    heading: "Recordings of calls and events",
    body: [
      "A recording can include speakers' original contributions, performances, music or shared media. Permission to attend a call or event is not automatically permission to record and republish it.",
      "Agree on recording and distribution before the event, and comply with applicable consent and privacy laws. Obtain rights covering included third-party material as well as any permission needed from participants.",
    ],
  },
  {
    heading: "Collaborative and commissioned work",
    body: [
      "A work made by several people or under a commission can have shared or contract-based ownership. One contributor may not be entitled to approve unrestricted publication of the entire work.",
      "Clarify ownership and reuse expectations before uploading a collaborative project. If an agreement limits sharing to a client or team, resolve that restriction before distributing it to a wider community.",
    ],
  },
  {
    heading: "Edits, remixes and adaptations",
    body: [
      "An edited or remixed version can still use protected elements of the original. A new caption, filter, translation or arrangement does not automatically eliminate the need for permission.",
      "Check whether the license permits adaptations and whether attribution or share-alike conditions apply. Your own contribution may have rights, while the underlying work remains subject to its owner's rights.",
    ],
  },
  {
    heading: "AI-assisted material",
    body: [
      "AI-assisted output can raise questions about protected source material, originality and the tool provider's terms. Copyright ownership and protection for such output vary with the jurisdiction and circumstances.",
      "Do not assume that using a generation tool guarantees that the result is free of third-party rights. Review the output and applicable terms, especially when it closely reproduces an existing work.",
    ],
  },
  {
    heading: "Kyro's operating permission",
    body: [
      "The Terms of Service give Kyro the technical permission needed to store, transmit, display and process content as part of operating the service. This is non-exclusive and does not transfer ownership of your work.",
      "For example, an attachment must be stored and delivered to authorized recipients. That operating permission does not automatically allow other members to commercially reuse the attachment or publish it outside the chosen audience.",
    ],
  },
  {
    heading: "Deletion and the scope of permission",
    body: [
      "Removing content ends ordinary display of the removed item through the applicable feature. Limited processing can still be needed for deletion, backups, legal obligations or records described in the Privacy Policy.",
      "An independent license you gave another person can have its own duration and cancellation terms. Deleting a Kyro post does not automatically revoke a valid separate license or erase a recipient's independent copy.",
    ],
  },
  {
    heading: "Bots and automated redistribution",
    body: [
      "Bots and integrations must have a lawful basis for collecting, displaying or redistributing protected material. Access permissions allow technical access; they do not establish ownership or a copyright license.",
      "A bot that reposts images or archives creative work should verify permission and license conditions. Developers should also provide a practical contact route for rights holders to raise a concern.",
    ],
  },
  {
    heading: "Moderation permissions and content rights",
    body: [
      "Community staff can manage content using their granted platform permissions. Being able to move, remove or display a member's contribution does not transfer the member's copyright to those staff.",
      "A server owner who wants to publish a collection of member artwork should obtain the necessary permission. Community rules can explain submission expectations, but cannot authorize rights the submitter does not hold.",
    ],
  },
  {
    heading: "Locating a reported work",
    body: [
      "A useful copyright report identifies both the original work and the specific material on Kyro that is disputed. Include message links or identifiers, relevant community or channel information and file details where available.",
      "A general request to remove an entire server may not identify the allegedly infringing material clearly enough. Provide a separate location for each item, or a representative list where the applicable procedure permits it.",
    ],
  },
  {
    heading: "Evidence of the original work",
    body: [
      "Provide a description or authorized source for the original work and explain how the reported material uses it. Publication records, source files, license terms or other relevant documentation can help clarify the claim.",
      "You do not need to send unrelated private files or every document you possess. Include enough to distinguish your work and the disputed use, and explain any permission or license you believe has been exceeded.",
    ],
  },
  {
    heading: "Authority to submit a claim",
    body: [
      "A rights holder or someone authorized to act for them should submit a copyright claim. Explain your relationship to the work and identify the owner if you are reporting on their behalf.",
      "If you are a viewer rather than the owner, you can flag a concern without claiming authority you do not have. A formal removal notice may need to come from the rights holder or their representative.",
    ],
  },
  {
    heading: "Good-faith and accurate reports",
    body: [
      "Reports should be accurate and account for any known permission, license or legal exception. Do not use a copyright claim to resolve an unrelated personal disagreement or claim ownership of material you do not control.",
      "A formal legal notice can require good-faith statements and a declaration of accuracy under penalty of perjury. Misrepresentations may have legal consequences; clarify uncertainties instead of presenting assumptions as established facts.",
    ],
  },
  {
    heading: "Contact details and formal notices",
    body: [
      "Send copyright concerns to support@kyro-chat.cyou with the subject 'Copyright report'. Include your contact information, the work, the disputed locations, your authority and an explanation; formal notices may also require a signature and statutory declarations.",
      "This support address is an intake contact and is not a representation that it is a registered statutory agent. Where a specific legal notice procedure applies, its required recipient and elements must also be satisfied.",
    ],
  },
  {
    heading: "Review and possible outcomes",
    body: [
      "Kyro may request clarification, restrict access to identified content or take other appropriate action after reviewing a copyright concern. Applicable legal notice requirements take priority over the general support process.",
      "A removal or restriction is not a court judgment about ownership. Information relevant to the claim may need to be shared with the affected uploader, subject to applicable law and the Privacy Policy.",
    ],
  },
  {
    heading: "Disputes and counter-notifications",
    body: [
      "If your content was restricted in error, contact support with the notice, the content location and your permission or legal basis. Where a statutory counter-notification process applies, it can require identifying details, a signature and specific legal statements.",
      "A counter-notice may be forwarded to the claimant and can involve legal proceedings. Applicable notice requirements, waiting periods and court orders govern whether and when access can be restored.",
    ],
  },
  {
    heading: "Repeated infringement and misuse of reports",
    body: [
      "Kyro may restrict or terminate accounts or integrations responsible for repeated infringement where appropriate. Deliberately false reports and attempts to bypass a content restriction may also lead to platform action.",
      "Relevant context includes the validity of claims, resolutions of disputes and applicable law. Correct a mistake promptly and provide supporting information instead of repeatedly reposting material while a claim remains unresolved.",
    ],
  },
  {
    heading: "Updates and copyright questions",
    body: [
      "The last-updated date identifies this policy version. Material changes will be surfaced on this page or in the product, with any additional notice required by applicable law.",
      "For permission questions about Kyro's own assets or a concern about content on the platform, contact support@kyro-chat.cyou. Identify the work and intended use so the request can be reviewed meaningfully.",
    ],
  },
];

export const LEGAL_POLICIES: LegalPolicy[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    intro:
      "These terms explain how to use Kyro, your responsibilities and the rules that apply to accounts, communities, content and integrations. Each section includes the rule and a practical explanation of what it means.",
    sections: TERMS,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    intro:
      "This policy explains what information Kyro handles, why it is used, who may receive it and how you can manage it. Each section describes a specific part of data handling and the choices or limits that matter to you.",
    sections: PRIVACY,
  },
  {
    slug: "copyright",
    title: "Copyright Policy",
    intro:
      "This policy explains who owns content, how permissions and licenses work, and how to raise or dispute a copyright concern. Each section includes practical guidance for members, community owners and developers.",
    sections: COPYRIGHT,
  },
];
