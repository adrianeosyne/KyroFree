import { Link } from "react-router";
import { COPYRIGHT_OWNER, LEGAL_UPDATED } from "@/lib/legalPolicies";

type Section = { heading: string; body: string[] };

const TERMS: Section[] = [
  {
    heading: "1. What Kyro is",
    body: [
      "Kyro is a free communication platform for communities: servers, channels, direct messages, roles, moderation and search. Kyro is provided as-is for personal and community use.",
      "Kyro is completely free. There are no paid plans, premium tiers, subscriptions or paywalled features, and we will not charge for the features that exist today.",
    ],
  },
  {
    heading: "2. Your account",
    body: [
      "You may create an account with your email and password. You are responsible for the activity that happens under your account.",
      "Before registration, you must affirmatively accept the Terms of Service, Privacy Policy and Copyright Policy. We record the policy versions and the time of acceptance. Privacy acknowledgement is separate from any optional advertising or marketing consent.",
      "Handles (@usernames) are unique and may be reclaimed if they violate these terms or remain associated with abandoned accounts.",
      "You must be at least 13 years old (or the minimum age required in your country) to use Kyro.",
    ],
  },
  {
    heading: "3. Acceptable use",
    body: [
      "Do not use Kyro to harass or threaten people, share content that is illegal, distribute malware, impersonate others, or disrupt communities with spam and abuse.",
      "Community moderators set the rules for their own communities. Following moderator decisions — including kicks, bans and channel restrictions — is a condition of participating there.",
      "Attempting to bypass bans, scrape other users' data, or probe or overload the service is not permitted.",
    ],
  },
  {
    heading: "4. Your content",
    body: [
      "You keep ownership of everything you post. You give Kyro the technical licence needed to store, transmit and display that content as part of operating the service.",
      "You can delete your account at any time from settings; that removes your profile, messages and community memberships from the live service.",
    ],
  },
  {
    heading: "5. Moderation and enforcement",
    body: [
      "We may remove content or suspend accounts that break these terms or the law. Where possible, we will tell you what happened.",
      "Community owners and moderators control their own communities; decisions made by them are their responsibility, though you can report abuse through the in-app reporting tools.",
    ],
  },
  {
    heading: "6. Availability",
    body: [
      "The service is provided without warranty. Features may change, and the service may be interrupted for maintenance or operational reasons.",
      "To the extent permitted by law, Kyro is not liable for indirect or consequential damages arising from your use of the platform.",
    ],
  },
  {
    heading: "7. Kyro intellectual property",
    body: [
      "Copyright © 2026 Adrian Eosyne. Rights in original Kyro source code, desktop code, branding, artwork and written materials are reserved to the extent owned by Adrian Eosyne. User content and third-party materials remain with their respective owners.",
      "Using Kyro or viewing its public source does not grant permission to copy, rebrand, redistribute or use protected Kyro files to create or host another website or service. The Copyright Policy at /copyright and the repository LICENSE describe the permitted uses and exceptions.",
      "These restrictions do not override third-party licences, previously granted valid licences, applicable statutory exceptions, or the right to create independently written software with similar unprotected ideas or functions.",
    ],
  },
  {
    heading: "8. Changes",
    body: [
      "We publish policy revisions with an updated date. New registrations must accept the current versions. Material changes will be communicated, and renewed acceptance will be requested where required by applicable law; this notice does not erase rights already granted.",
    ],
  },
];

const PRIVACY: Section[] = [
  {
    heading: "What we collect",
    body: [
      "Account data: the email address used to sign in, the @username and display name you choose, avatar, bio, status and preferences.",
      "Content data: messages, replies, attachments, reactions and community membership records you create.",
      "Operational data: session records used to keep you signed in and to let you review or revoke active devices, plus basic timestamps needed for read state and notifications.",
      "Policy acceptance data: the versions of the Terms of Service, Privacy Policy and Copyright Policy accepted when an account is created, and the server-recorded acceptance time. We use these records to document registration requirements, respond to disputes and meet legal obligations. They are included in your account data export and are not public profile fields.",
      "Advertising data: on screens where a banner is enabled, Google AdSense may process device and browser information, IP address, cookie identifiers and consent signals to serve, secure and measure ads, subject to your region and consent choices.",
    ],
  },
  {
    heading: "How it is used",
    body: [
      "To run the product: deliver messages, show presence, count unread items, moderate communities and keep the service reliable.",
      "To protect the service: enforce bans, blocks, privacy settings and rate limits, and to investigate abuse reports.",
      "Limited banner advertising helps fund the free service. Kyro does not sell your private messages or read them to build advertising profiles.",
    ],
  },
  {
    heading: "What is shared",
    body: [
      "Other users see what you choose to make visible: your display name, handle, avatar, status, messages in communities you join, and whether you are online if you allow presence to be shown.",
      "Community moderators can see your messages in their communities and manage your membership. Server audit logs record moderator actions.",
      "When an advertising placement is enabled, Google receives the request, device and consent information needed to serve and measure that placement under Google's own privacy terms.",
      "We do not disclose your data to third parties except where required by law or to operate core infrastructure (for example, message and file storage).",
    ],
  },
  {
    heading: "Your controls",
    body: [
      "Privacy settings let you restrict who can send you direct messages or friend requests, hide your presence (including an invisible mode), and mute communities.",
      "From account settings you can review and revoke sessions, export a copy of the data Kyro holds about you, and permanently delete your account.",
      "Blocking a user stops direct contact in both directions.",
    ],
  },
  {
    heading: "Retention and contact",
    body: [
      "Messages and attachments are retained while the account and the communities they belong to exist. Deleting your account removes your profile and messages from the live service; backup copies age out on a routine schedule.",
      "Questions about this policy can be raised through the in-app support channels linked in your account settings.",
      "You can also contact support@kyro-chat.cyou about privacy or policy acceptance. Accepting this policy does not waive privacy rights or give blanket consent to optional tracking or marketing.",
    ],
  },
];

const COPYRIGHT: Section[] = [
  {
    heading: "1. Ownership and protected materials",
    body: [
      "Copyright © 2026 Adrian Eosyne. All rights reserved in original Kyro materials to the extent owned by Adrian Eosyne, including application and desktop source code, original website text, custom graphics, logos and artwork. Contributor-owned and third-party materials retain their respective owners and licences.",
      "Copyright protects original expression, not general ideas, concepts, common interface patterns or functionality. This policy does not claim ownership of all chat websites or prohibit independently created software merely because it offers similar features.",
    ],
  },
  {
    heading: "2. What you may do",
    body: [
      "You may use the official Kyro service and install and run the official desktop application for personal and community communication, subject to the Terms of Service. You may receive official updates, read the published source for reference and report problems.",
      "A public GitHub repository is not an open-source licence. Viewing or forking the repository as permitted by GitHub's applicable terms does not by itself grant permission to deploy a copy, distribute a derivative product, or reuse protected Kyro files outside those permissions. The repository LICENSE states the applicable source-use terms.",
    ],
  },
  {
    heading: "3. Reuse and competing copies",
    body: [
      "Without prior written permission from Adrian Eosyne, you may not copy, adapt, redistribute, sell, sublicense or rebrand protected Kyro files, or use all or a substantial protected part of them to create or host another website, app or service, whether free or commercial. Removing attribution or changing names or colours does not create permission.",
      "Do not use Kyro's name, logo or branding to imply that an unrelated product is official, endorsed or affiliated. Any trademark rights are subject to applicable law; this notice does not assert a registered trademark where none has been registered.",
      "Permissions required by law, fair use or fair dealing where applicable, third-party licences, and previously granted valid licences are preserved. These terms cover only rights the relevant rights holder can lawfully control.",
    ],
  },
  {
    heading: "4. User content and third-party software",
    body: [
      "You retain your rights in the messages, uploads and other original content you provide. The limited operational licence in the Terms of Service lets Kyro store, transmit and display that content; it does not transfer your ownership to Adrian Eosyne.",
      "Libraries, frameworks, fonts, icons and other third-party materials remain governed by their own licences and notices. This policy and Kyro's repository licence do not restrict permissions those licences independently grant or remove required attribution.",
    ],
  },
  {
    heading: "5. Request permission or report infringement",
    body: [
      "Send permission requests or copyright reports to support@kyro-chat.cyou, addressed to Adrian Eosyne. For permission, describe the exact material and planned use. Permission must be expressly granted in writing; silence is not permission.",
      "For an infringement report, provide your name and contact details, identify the work and your ownership or authority, include the specific URLs or files at issue, and explain the alleged copying. Supply a good-faith statement and signature or other declarations where the applicable notice process requires them. Do not send passwords or unrelated sensitive information.",
      "We review reports and may request supporting information. If you believe your content was removed by mistake, contact the same address with the relevant details. Hosting platforms may provide their own formal notice and counter-notice procedures. Knowingly false notices may carry legal consequences where applicable law provides them.",
    ],
  },
  {
    heading: "6. Platform consequences",
    body: [
      "Where a violation is established, Kyro may request that the conduct stop, remove or restrict infringing content, issue a warning, suspend access or terminate an account, subject to the Terms of Service and applicable law. Repeated or serious violations may result in termination. These measures do not determine anyone's criminal liability.",
      "Where appropriate and legally available, the rights holder may send a cease-and-desist request or submit a copyright complaint to a host, repository platform, search provider or other relevant service. A complaint does not guarantee removal; the recipient's rules and the applicable legal process still apply.",
    ],
  },
  {
    heading: "7. Legal remedies and penalties",
    body: [
      "Subject to the law and facts, the rights holder may seek a court order stopping infringement, damages, recovery of attributable profits, and legal costs or fees where recoverable. A court or other competent authority decides whether a remedy is available and its amount. This policy imposes no automatic fine and promises no particular award.",
      "Some jurisdictions provide criminal penalties for certain intentional infringement offences. Only the relevant authorities and courts can investigate, prosecute or impose those penalties. Kyro cannot impose imprisonment, and a breach of this policy does not automatically constitute a crime.",
      "Available remedies, defences, exceptions, notice requirements and time limits depend on the applicable law. Nothing here excludes mandatory consumer or other statutory rights.",
    ],
  },
  {
    heading: "8. Policy versions and acceptance",
    body: [
      "New users must accept the current Copyright Policy, Terms of Service and Privacy Policy before an account is created. Kyro records the accepted versions and the acceptance time. Policy acceptance does not transfer ownership of your content or waive rights that cannot lawfully be waived.",
    ],
  },
];

function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: Section[];
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-white">
              K
            </span>
            Kyro
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {updated}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          {intro}
        </p>
        <nav
          aria-label="Legal policies"
          className="mt-6 flex flex-wrap gap-4 text-sm"
        >
          <Link
            to="/terms"
            className="text-primary underline underline-offset-4"
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            className="text-primary underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          <Link
            to="/copyright"
            className="text-primary underline underline-offset-4"
          >
            Copyright Policy
          </Link>
        </nav>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
          <p>
            © 2026 {COPYRIGHT_OWNER}. All rights reserved in original Kyro
            materials, subject to the permissions and exceptions described
            above.
          </p>
          <p className="mt-3">
            Policy enquiries:{" "}
            <a
              href="mailto:support@kyro-chat.cyou"
              className="text-primary underline"
            >
              support@kyro-chat.cyou
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

/** Inline policy review keeps registration fields intact, including in Electron. */
export function LegalPolicyContent({
  policy,
}: {
  policy: "terms" | "privacy" | "copyright";
}) {
  const title =
    policy === "terms"
      ? "Terms of Service"
      : policy === "privacy"
        ? "Privacy Policy"
        : "Copyright Policy";
  const sections =
    policy === "terms" ? TERMS : policy === "privacy" ? PRIVACY : COPYRIGHT;
  return (
    <article className="space-y-6 text-sm leading-6">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1 text-muted-foreground">
          Last updated {LEGAL_UPDATED}
        </p>
      </div>
      {sections.map((section) => (
        <section key={section.heading}>
          <h3 className="font-semibold">{section.heading}</h3>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <p>
        © 2026 {COPYRIGHT_OWNER}. Policy enquiries:{" "}
        <a
          className="text-primary underline"
          href="mailto:support@kyro-chat.cyou"
        >
          support@kyro-chat.cyou
        </a>
      </p>
    </article>
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={LEGAL_UPDATED}
      intro="These terms govern your use of Kyro. By creating an account or using the platform you agree to them."
      sections={TERMS}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={LEGAL_UPDATED}
      intro="This policy explains what Kyro stores, why it is stored, and the controls you have over it."
      sections={PRIVACY}
    />
  );
}

export function CopyrightPage() {
  return (
    <LegalPage
      title="Copyright Policy"
      updated={LEGAL_UPDATED}
      intro="Kyro's original materials belong to Adrian Eosyne. This policy explains permitted use, restrictions on copying Kyro files, how to request permission, and the enforcement measures available under applicable law."
      sections={COPYRIGHT}
    />
  );
}
