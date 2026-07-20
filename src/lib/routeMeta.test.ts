import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRouteMeta, type DocumentLike } from "./routeMeta.ts";

class FakeElement {
  tagName: string;
  private attrs = new Map<string, string>();
  constructor(tagName: string) {
    this.tagName = tagName;
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
}

function makeFakeDocument(preexisting: FakeElement[] = []): DocumentLike & { headTags: FakeElement[] } {
  const headTags = [...preexisting];
  return {
    title: "Default Title",
    head: {
      querySelector(selector: string) {
        // Matches `meta[name="x"]`, `meta[property="x"]`, `link[rel="x"]`
        const match = selector.match(/^(meta|link)\[(name|property|rel)="([^"]+)"\]$/);
        if (!match) return null;
        const [, tag, attr, value] = match;
        return (headTags.find((el) => el.tagName === tag && el.getAttribute(attr) === value) as unknown as Element) ?? null;
      },
      appendChild<T extends Node>(node: T) {
        headTags.push(node as unknown as FakeElement);
        return node;
      },
      removeChild<T extends Node>(node: T) {
        const idx = headTags.indexOf(node as unknown as FakeElement);
        if (idx >= 0) headTags.splice(idx, 1);
        return node;
      },
    },
    createElement(tagName: string) {
      return new FakeElement(tagName) as unknown as HTMLElement;
    },
    headTags,
  };
}

test("applyRouteMeta sets title, description, canonical, OG and Twitter tags", () => {
  const doc = makeFakeDocument();
  applyRouteMeta(doc, {
    title: "Chirpy — Wallet-native chat for any community | Bittrees",
    description: "Private DMs and token-gated rooms in one wallet-native app.",
    canonical: "https://gov.bittrees.org/chirpy",
    ogImage: "https://gov.bittrees.org/bittrees_logo_tree.png",
    twitterCard: "summary_large_image",
  });

  assert.equal(doc.title, "Chirpy — Wallet-native chat for any community | Bittrees");

  const get = (tag: string, attr: string, value: string) =>
    doc.headTags.find((el) => el.tagName === tag && el.getAttribute(attr) === value);

  assert.equal(get("meta", "name", "description")?.getAttribute("content"), "Private DMs and token-gated rooms in one wallet-native app.");
  assert.equal(get("link", "rel", "canonical")?.getAttribute("href"), "https://gov.bittrees.org/chirpy");
  assert.equal(get("meta", "property", "og:title")?.getAttribute("content"), "Chirpy — Wallet-native chat for any community | Bittrees");
  assert.equal(get("meta", "property", "og:image")?.getAttribute("content"), "https://gov.bittrees.org/bittrees_logo_tree.png");
  assert.equal(get("meta", "name", "twitter:card")?.getAttribute("content"), "summary_large_image");
  assert.equal(get("meta", "name", "twitter:image")?.getAttribute("content"), "https://gov.bittrees.org/bittrees_logo_tree.png");
});

test("applyRouteMeta reuses an existing tag instead of duplicating it", () => {
  const existingCanonical = new FakeElement("link");
  existingCanonical.setAttribute("rel", "canonical");
  existingCanonical.setAttribute("href", "https://gov.bittrees.org/");
  const doc = makeFakeDocument([existingCanonical]);

  applyRouteMeta(doc, {
    title: "Chirpy",
    description: "desc",
    canonical: "https://gov.bittrees.org/chirpy",
  });

  const canonicals = doc.headTags.filter((el) => el.tagName === "link" && el.getAttribute("rel") === "canonical");
  assert.equal(canonicals.length, 1, "must not create a duplicate canonical link");
  assert.equal(canonicals[0].getAttribute("href"), "https://gov.bittrees.org/chirpy");
});

test("cleanup restores prior title and pre-existing tag values, and removes newly created tags", () => {
  const existingDescription = new FakeElement("meta");
  existingDescription.setAttribute("name", "description");
  existingDescription.setAttribute("content", "Site-wide default description.");
  const doc = makeFakeDocument([existingDescription]);
  doc.title = "Bittrees, Inc. — Governance";

  const cleanup = applyRouteMeta(doc, {
    title: "Chirpy — Wallet-native chat for any community | Bittrees",
    description: "Private DMs and token-gated rooms in one wallet-native app.",
    canonical: "https://gov.bittrees.org/chirpy",
  });

  // Route was applied.
  assert.equal(doc.title, "Chirpy — Wallet-native chat for any community | Bittrees");
  assert.ok(doc.headTags.some((el) => el.tagName === "link" && el.getAttribute("rel") === "canonical"));

  cleanup();

  assert.equal(doc.title, "Bittrees, Inc. — Governance", "title should be restored on cleanup");
  assert.equal(
    doc.headTags.find((el) => el.tagName === "meta" && el.getAttribute("name") === "description")?.getAttribute("content"),
    "Site-wide default description.",
    "pre-existing tag content should be restored, not left overwritten",
  );
  assert.ok(
    !doc.headTags.some((el) => el.tagName === "link" && el.getAttribute("rel") === "canonical"),
    "canonical link created by applyRouteMeta should be removed on cleanup",
  );
});
