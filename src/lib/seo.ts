export const SITE_URL = "https://gov.bittrees.org";
export const SOCIAL_IMAGE = `${SITE_URL}/social/governance.png`;
export const IMAGE_ALT = "Bittrees Governance — proposals, voting and community, with the Bittrees tree emblem.";
export const publicPages: Record<string, { title: string; description: string }> = {
  "/": { title: "Bittrees Governance | Proposals, Voting & Community", description: "Explore Bittrees governance: follow Snapshot proposals, learn about BGOV voting, discover the organization and take part in the community." },
  "/proposals": { title: "Governance Proposals | Bittrees", description: "Browse Bittrees governance proposals and follow voting activity from the gov.bittrees.eth Snapshot space." },
  "/structure": { title: "Governance Structure | Bittrees", description: "Explore the Bittrees Central Committee, subDAOs and governance structure, with links to the organization's on-chain records." },
  "/mint": { title: "BGOV Token & Voting | Bittrees Governance", description: "Learn about BGOV and its role in Bittrees governance. View token information and connect a wallet to explore available actions." },
  "/forum": { title: "Community Forum | Bittrees Governance", description: "Follow community discussions in the Bittrees forum and connect proposals with the conversations behind them." },
  "/contribute": { title: "Become a Contributor | Bittrees", description: "Explore how to contribute to Bittrees, review contributor roles and find the application process for community participation." },
  "/vision": { title: "Vision Statement | Bittrees", description: "Read the Bittrees vision statement and learn about the ideas guiding the organization and its community." },
  "/code-of-conduct": { title: "Code of Conduct | Bittrees", description: "Read the Bittrees community code of conduct, including expectations for respectful participation and collaboration." },
  "/hq": { title: "Metaverse Headquarters | Bittrees", description: "Visit the Bittrees headquarters in Voxels and explore the organization's shared space in the metaverse." },
  "/69420": { title: "Revenue & Token Flow | Bittrees", description: "Explore the Bittrees revenue and token-flow model and how its components relate to the wider organization." },
  "/chirpy": { title: "Chat | Messaging, Email & Community | Bittrees", description: "Open Bittrees Chat for wallet messaging, community rooms, connected Bittrees Mail and updates from the Governance forum." },
};
export const privatePages = ["/admin", "/proposals/new", "/messenger"];
export function routeSeo(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const page = publicPages[path];
  return {
    title: page?.title ?? "Workspace | Bittrees Governance",
    description: page?.description ?? "Connect to the Bittrees governance workspace. Access to actions and conversations depends on your permissions.",
    canonical: SITE_URL + path,
    robots: page ? "index,follow,max-image-preview:large" : "noindex,follow",
    ogImage: SOCIAL_IMAGE,
    twitterCard: "summary_large_image" as const,
  };
}
