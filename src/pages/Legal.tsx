import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import {
  LEGAL_POLICIES,
  LEGAL_UPDATED,
  type LegalPolicy,
} from "@/lib/legalContent";
import { COPYRIGHT_OWNER, LEGAL_POLICY_VERSIONS } from "@/lib/legalPolicies";

function LegalPage({ policy }: { policy: LegalPolicy }) {
  const { hash } = useLocation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${policy.title} | Kyro`;
    return () => {
      document.title = previousTitle;
    };
  }, [policy.title]);

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [policy.slug, hash]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md print:hidden">
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

      <main
        id="legal-top"
        className="mx-auto max-w-3xl scroll-mt-24 px-4 py-14 sm:px-6"
      >
        <h1 className="text-3xl font-bold tracking-tight">{policy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated{" "}
          <time dateTime={LEGAL_UPDATED.date}>{LEGAL_UPDATED.label}</time>
          <span aria-hidden="true"> · </span>
          {policy.sections.length} explained sections
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Policy version {LEGAL_POLICY_VERSIONS[policy.slug]}
        </p>
        <p className="mt-6 text-sm leading-7 text-muted-foreground sm:text-base">
          {policy.intro}
        </p>

        <nav
          aria-label="Policy navigation"
          className="mt-7 flex flex-wrap gap-2 print:hidden"
        >
          {LEGAL_POLICIES.map((item) => (
            <Link
              key={item.slug}
              to={`/${item.slug}`}
              aria-current={policy.slug === item.slug ? "page" : undefined}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                policy.slug === item.slug
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <details className="mt-8 rounded-xl border border-border/70 bg-card p-5 print:hidden">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            Browse all {policy.sections.length} sections
          </summary>
          <nav aria-label="On this page" className="mt-4">
            <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {policy.sections.map((section, index) => (
                <li key={section.heading}>
                  <a
                    href={`#section-${index + 1}`}
                    className="flex gap-2 rounded-md py-2 text-sm leading-5 text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="min-w-6 shrink-0 tabular-nums">
                      {index + 1}.
                    </span>
                    <span>{section.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </details>

        <div className="mt-10 space-y-10">
          {policy.sections.map((section, index) => (
            <section
              key={section.heading}
              id={`section-${index + 1}`}
              aria-labelledby={`heading-${index + 1}`}
              className="scroll-mt-24"
            >
              <h2 id={`heading-${index + 1}`} className="text-lg font-semibold">
                {index + 1}. {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <aside
          aria-label="Policy support"
          className="mt-12 rounded-xl border border-border/70 bg-card p-5 text-sm leading-6 text-muted-foreground"
        >
          <p className="font-semibold text-foreground">Policy support</p>
          <p className="mt-2">
            For questions or requests about this policy, contact{" "}
            <a
              href="mailto:support@kyro-chat.cyou"
              className="break-all text-primary underline underline-offset-4"
            >
              support@kyro-chat.cyou
            </a>
            . Include the relevant account or content and a short explanation.
            Keep passwords and recovery codes private.
          </p>
          <p className="mt-3">
            Kyro is free for everyone, with no paid tiers or paywalled features.
          </p>
        </aside>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground print:hidden">
          <p>
            © {new Date().getFullYear()} {COPYRIGHT_OWNER}. Rights in member
            content remain with their owners.
          </p>
          <a href="#legal-top" className="shrink-0 hover:text-foreground">
            Back to top ↑
          </a>
        </div>
      </main>
    </div>
  );
}

/** Signup reviews use the same content and versions as the public policy pages. */
export function LegalPolicyContent({
  policy,
}: {
  policy: LegalPolicy["slug"];
}) {
  const document = LEGAL_POLICIES.find((item) => item.slug === policy)!;
  return (
    <article className="space-y-6 text-sm leading-6">
      <div>
        <h2 className="text-xl font-bold">{document.title}</h2>
        <p className="mt-1 text-muted-foreground">
          Last updated {LEGAL_UPDATED.label} · Version{" "}
          {LEGAL_POLICY_VERSIONS[policy]}
        </p>
        <p className="mt-3 text-muted-foreground">{document.intro}</p>
      </div>
      {document.sections.map((section, index) => (
        <section key={section.heading}>
          <h3 className="font-semibold">
            {index + 1}. {section.heading}
          </h3>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <p>
        © {new Date().getFullYear()} {COPYRIGHT_OWNER}. Policy enquiries:{" "}
        <a
          href="mailto:support@kyro-chat.cyou"
          className="text-primary underline"
        >
          support@kyro-chat.cyou
        </a>
      </p>
    </article>
  );
}

export function TermsPage() {
  return <LegalPage policy={LEGAL_POLICIES[0]} />;
}

export function PrivacyPage() {
  return <LegalPage policy={LEGAL_POLICIES[1]} />;
}

export function CopyrightPage() {
  return <LegalPage policy={LEGAL_POLICIES[2]} />;
}
