import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import type { ComponentType } from "react";
import Overview from "./pages/Overview";
import Vision from "./pages/Vision";
import CodeOfConduct from "./pages/CodeOfConduct";
import Metaverse from "./pages/Metaverse";
import TokenFlow from "./pages/TokenFlow";
import StructureContent from "./components/StructureContent";
import Footer from "./components/Footer";
import { ProposalArchiveList, HistoricalProposalContent } from "./components/ProposalArchive";
import { historicalProposalForPath } from "./lib/proposalArchive";
import {
  ProposalsIntroduction,
  ForumIntroduction,
  ContributionIntroduction,
  MintIntroduction,
} from "./components/PublicIntroductions";

// Public-only entry: no wallet providers, sessions, API readers or live records.
// The only proposal bodies are the explicitly reviewed historical source cohort.
const publicContent: Record<string, ComponentType> = {
  "/": Overview,
  "/proposals": () => <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}><ProposalsIntroduction /><ProposalArchiveList /></div>,
  "/structure": StructureContent,
  "/mint": MintIntroduction,
  "/forum": ForumIntroduction,
  "/contribute": ContributionIntroduction,
  "/vision": Vision,
  "/code-of-conduct": CodeOfConduct,
  "/hq": Metaverse,
  "/69420": TokenFlow,
};

export function renderPublicPage(path: string): string {
  const archived = historicalProposalForPath(path);
  const Content = archived ? () => <HistoricalProposalContent entry={archived} /> : publicContent[path];
  if (!Content) throw new Error(`No approved public content renderer for ${path}`);

  return renderToStaticMarkup(
    <StaticRouter location={path}>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
        <header style={{ borderBottom: "1px solid var(--color-border)", background: "#ffffff" }}>
          <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "1rem 1.5rem" }}>
            <a href="/" style={{ fontFamily: "var(--font-logo)", fontWeight: 700, color: "var(--color-ink)", textDecoration: "none" }}>
              Bittrees Governance
            </a>
          </div>
        </header>
        <main className="flex-1 w-full" style={{ maxWidth: "1140px", width: "100%", margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
          <Content />
          <noscript><p>Enable JavaScript for live data, wallet connections and interactive governance tools.</p></noscript>
        </main>
        <Footer />
      </div>
    </StaticRouter>,
  );
}
