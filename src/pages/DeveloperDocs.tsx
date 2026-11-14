import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Menu,
  Search,
  X,
} from "lucide-react";
import { DOC_PAGES, searchDocs } from "@/lib/developerDocs";
import { API_ENDPOINTS } from "@/lib/apiReference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function Code({
  code,
  language = "text",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const tokens = code.split(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:import|from|const|let|await|async|new|return|if|true|false|null|export|function)\b|\b\d+\b)/g,
  );
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0C0E14]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-xs text-slate-400">
        <span>{language}</span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Copy code"
          onClick={() =>
            void navigator.clipboard.writeText(code).then(
              () => setCopied(true),
              () => toast.error("Could not copy code"),
            )
          }
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6 sm:text-sm">
        <code>
          {tokens.map((token, i) => (
            <span
              key={i}
              className={
                /^["']/.test(token)
                  ? "text-emerald-300"
                  : /^(import|from|const|let|await|async|new|return|if|true|false|null|export|function)$/.test(
                        token,
                      )
                    ? "text-purple-300"
                    : /^\d+$/.test(token)
                      ? "text-amber-200"
                      : "text-slate-200"
              }
            >
              {token}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
export default function DeveloperDocs() {
  const { slug = "welcome" } = useParams();
  const page = DOC_PAGES.find((p) => p.slug === slug);
  const [search, setSearch] = useState(""),
    [mobile, setMobile] = useState(false);
  const groups = [...new Set(DOC_PAGES.map((p) => p.group))];
  const results = searchDocs(search);
  const index = DOC_PAGES.findIndex((p) => p.slug === slug);
  useEffect(() => {
    document.title = `${page?.title ?? "Page not found"} | Kyro Developers`;
    window.scrollTo(0, 0);
  }, [page]);
  const navigation = (
    <>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 text-slate-400" size={16} />
        <Input
          className="border-white/10 bg-[#10121A] pl-9"
          aria-label="Search documentation"
          placeholder="Search documentation"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search.trim() ? (
        <div aria-live="polite">
          <p className="mb-3 text-xs text-slate-400">
            {results.length} results
          </p>
          {results.map((p) => (
            <Link
              key={p.slug}
              to={`/docs/${p.slug}`}
              onClick={() => {
                setMobile(false);
                setSearch("");
              }}
              className="mb-3 block rounded p-2 hover:bg-white/5"
            >
              <p className="text-sm text-indigo-300">{p.title}</p>
              <p className="text-xs text-slate-400">{p.summary}</p>
            </Link>
          ))}
        </div>
      ) : (
        groups.map((group) => (
          <div key={group} className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {group}
            </p>
            {DOC_PAGES.filter((p) => p.group === group).map((p) => (
              <Link
                key={p.slug}
                to={`/docs/${p.slug}`}
                aria-current={slug === p.slug ? "page" : undefined}
                onClick={() => setMobile(false)}
                className={`mb-1 block rounded-lg px-3 py-2 text-sm ${slug === p.slug ? "bg-indigo-500/15 text-indigo-300" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                {p.title}
              </Link>
            ))}
          </div>
        ))
      )}
    </>
  );
  return (
    <div className="min-h-screen bg-[#11131B] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#11131B]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-8">
          <Link to="/docs" className="flex items-center gap-3 font-semibold">
            <img src="/logo.svg" alt="Kyro" width={30} height={30} />
            Kyro Developers
            <span className="hidden rounded border border-indigo-400/25 px-2 py-1 text-xs font-normal text-indigo-300 sm:block">
              API v1 · SDK 0.2.0
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/developers"
              className="text-sm text-indigo-300"
            >
              Developer portal
            </Link>
            <Button
              className="lg:hidden"
              variant="ghost"
              aria-label={mobile ? "Close navigation" : "Open navigation"}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1400px]">
        <aside
          className="sticky top-16 hidden h-[calc(100vh-4rem)] w-72 shrink-0 overflow-y-auto border-r border-white/10 p-6 lg:block"
          aria-label="Documentation navigation"
        >
          {navigation}
        </aside>
        {mobile && (
          <aside
            className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto bg-[#11131B] p-6 lg:hidden"
            aria-label="Mobile documentation navigation"
          >
            {navigation}
          </aside>
        )}
        <main className="min-w-0 flex-1 px-5 py-8 sm:px-10 lg:px-14">
          <div className="max-w-4xl">
            {page ? (
              <>
                <nav
                  aria-label="Breadcrumb"
                  className="mb-6 text-xs text-slate-400"
                >
                  <Link to="/docs">Documentation</Link> / {page.group} /{" "}
                  <span className="text-slate-200">{page.title}</span>
                </nav>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
                  {page.group}
                </p>
                <h1 className="text-3xl font-bold sm:text-4xl">{page.title}</h1>
                <p className="mb-10 mt-4 text-lg leading-8 text-slate-400">
                  {page.summary}
                </p>
                {page.sections.map((section, i) => (
                  <section
                    key={i}
                    id={`section-${i}`}
                    className="mb-9 scroll-mt-20"
                  >
                    <h2 className="mb-3 text-xl font-semibold">
                      {section.title}
                    </h2>
                    <p className="whitespace-pre-line text-sm leading-7 text-slate-300">
                      {section.text}
                    </p>
                    {section.code && (
                      <Code code={section.code} language={section.language} />
                    )}
                  </section>
                ))}
                {page.slug === "api" &&
                  API_ENDPOINTS.map((e) => (
                    <section
                      key={e.id}
                      id={e.id}
                      className="mb-8 scroll-mt-24 rounded-xl border border-white/10 p-4 sm:p-6"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <span className="rounded bg-indigo-400/15 px-2 py-1 font-mono text-xs text-indigo-300">
                          {e.method}
                        </span>
                        <h2 className="break-all font-mono text-sm">
                          /api/v1/{e.path}
                        </h2>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-slate-300">
                        {e.description}
                      </p>
                      <dl className="mt-4 space-y-2 text-xs leading-6 text-slate-400">
                        <div>
                          <dt className="inline font-semibold text-slate-200">
                            Authentication:{" "}
                          </dt>
                          <dd className="inline">
                            {e.id === "webhook-key"
                              ? "Public endpoint"
                              : "Authorization: Bot <token>"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-slate-200">
                            Permissions:{" "}
                          </dt>
                          <dd className="inline">{e.permission}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-slate-200">
                            Path parameters:{" "}
                          </dt>
                          <dd className="inline">
                            {(e.path.match(/:[A-Za-z]+/g) ?? []).join(", ") ||
                              "None"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-slate-200">
                            Query:{" "}
                          </dt>
                          <dd className="inline">{e.query || "None"}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-slate-200">
                            Rate limit:{" "}
                          </dt>
                          <dd className="inline">
                            {e.id === "webhook-key"
                              ? "Public key discovery; cache the pinned key."
                              : "120 requests/minute; 429 includes Retry-After."}{" "}
                            {e.notes}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold text-slate-200">
                            Errors:{" "}
                          </dt>
                          <dd className="inline">
                            400 invalid request; 401 invalid/revoked
                            credentials; 403 denied; 404 unavailable resource;
                            409 conflict; 410 expired interaction; 429 rate
                            limited. Envelope:{" "}
                            {`{ok:false,error:{code,message}}`}
                          </dd>
                        </div>
                      </dl>
                      {e.body && (
                        <>
                          <h3 className="mt-4 text-sm font-medium">
                            Request body
                          </h3>
                          <Code
                            code={JSON.stringify(e.body, null, 2)}
                            language="json"
                          />
                        </>
                      )}
                      <h3 className="mt-4 text-sm font-medium">
                        Response example
                      </h3>
                      <Code
                        code={JSON.stringify(
                          { ok: true, data: e.response },
                          null,
                          2,
                        )}
                        language="json"
                      />
                    </section>
                  ))}
                <nav
                  className="mt-12 flex justify-between gap-4 border-t border-white/10 pt-6"
                  aria-label="Previous and next pages"
                >
                  {index > 0 ? (
                    <Link
                      className="flex items-center gap-2 text-sm text-indigo-300"
                      to={`/docs/${DOC_PAGES[index - 1].slug}`}
                    >
                      <ChevronLeft size={16} />
                      {DOC_PAGES[index - 1].title}
                    </Link>
                  ) : (
                    <span />
                  )}
                  {index + 1 < DOC_PAGES.length && (
                    <Link
                      className="flex items-center gap-2 text-right text-sm text-indigo-300"
                      to={`/docs/${DOC_PAGES[index + 1].slug}`}
                    >
                      {DOC_PAGES[index + 1].title}
                      <ChevronRight size={16} />
                    </Link>
                  )}
                </nav>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-semibold">
                  Documentation page not found
                </h1>
                <Link className="mt-4 block text-indigo-300" to="/docs">
                  Return to documentation
                </Link>
              </>
            )}
            <footer className="mt-12 text-xs text-slate-500">
              Kyro Developer Platform · Free to use · API v1 ·{" "}
              <a
                href="https://github.com/adrianeosyne/KyroFree"
                className="text-slate-400"
              >
                Source on GitHub
              </a>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
