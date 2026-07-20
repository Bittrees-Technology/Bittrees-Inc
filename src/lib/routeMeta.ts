import { useEffect } from "react";

/**
 * This is a client-rendered SPA (no SSR), so route-specific <head> tags have
 * to be applied via JS after mount and rolled back on unmount — otherwise a
 * route's title/OG tags leak into whatever page the user navigates to next.
 */
export interface RouteMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: "summary" | "summary_large_image";
}

interface HeadLike {
  querySelector(selectors: string): Element | null;
  appendChild<T extends Node>(node: T): T;
  removeChild<T extends Node>(node: T): T;
}

export interface DocumentLike {
  title: string;
  head: HeadLike;
  createElement(tagName: string): HTMLElement;
}

type ContentAttr = "content" | "href";

interface TagSpec {
  selector: string;
  attr: "name" | "property" | "rel";
  key: string;
  value: string;
  contentAttr: ContentAttr;
}

function upsertTag(doc: DocumentLike, spec: TagSpec): { el: Element; existed: boolean; previous: string | null } {
  const existing = doc.head.querySelector(spec.selector);
  if (existing) {
    const previous = existing.getAttribute(spec.contentAttr);
    existing.setAttribute(spec.contentAttr, spec.value);
    return { el: existing, existed: true, previous };
  }
  const el = doc.createElement(spec.attr === "rel" ? "link" : "meta");
  el.setAttribute(spec.attr, spec.key);
  el.setAttribute(spec.contentAttr, spec.value);
  doc.head.appendChild(el);
  return { el, existed: false, previous: null };
}

function buildSpecs(meta: RouteMeta): TagSpec[] {
  const ogTitle = meta.ogTitle ?? meta.title;
  const ogDescription = meta.ogDescription ?? meta.description;

  const specs: TagSpec[] = [
    { selector: 'meta[name="description"]', attr: "name", key: "description", value: meta.description, contentAttr: "content" },
    { selector: 'link[rel="canonical"]', attr: "rel", key: "canonical", value: meta.canonical, contentAttr: "href" },
    { selector: 'meta[property="og:type"]', attr: "property", key: "og:type", value: "website", contentAttr: "content" },
    { selector: 'meta[property="og:url"]', attr: "property", key: "og:url", value: meta.canonical, contentAttr: "content" },
    { selector: 'meta[property="og:title"]', attr: "property", key: "og:title", value: ogTitle, contentAttr: "content" },
    { selector: 'meta[property="og:description"]', attr: "property", key: "og:description", value: ogDescription, contentAttr: "content" },
    { selector: 'meta[name="twitter:card"]', attr: "name", key: "twitter:card", value: meta.twitterCard ?? "summary", contentAttr: "content" },
    { selector: 'meta[name="twitter:title"]', attr: "name", key: "twitter:title", value: ogTitle, contentAttr: "content" },
    { selector: 'meta[name="twitter:description"]', attr: "name", key: "twitter:description", value: ogDescription, contentAttr: "content" },
  ];

  if (meta.ogImage) {
    specs.push({ selector: 'meta[property="og:image"]', attr: "property", key: "og:image", value: meta.ogImage, contentAttr: "content" });
    specs.push({ selector: 'meta[name="twitter:image"]', attr: "name", key: "twitter:image", value: meta.ogImage, contentAttr: "content" });
  }

  return specs;
}

/** Applies route-specific <head> metadata to `doc` and returns a cleanup that restores the prior state. */
export function applyRouteMeta(doc: DocumentLike, meta: RouteMeta): () => void {
  const previousTitle = doc.title;
  doc.title = meta.title;

  const applied = buildSpecs(meta).map((spec) => ({ spec, result: upsertTag(doc, spec) }));

  return function cleanup() {
    doc.title = previousTitle;
    for (const { result } of applied) {
      if (result.existed) {
        if (result.previous !== null) {
          result.el.setAttribute(result.el.tagName.toLowerCase() === "link" ? "href" : "content", result.previous);
        }
      } else {
        doc.head.removeChild(result.el);
      }
    }
  };
}

/** Sets document title + description/canonical/OG/Twitter tags for the lifetime of the mounted route. */
export function useRouteMeta(meta: RouteMeta): void {
  useEffect(
    () => applyRouteMeta(document, meta),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.title, meta.description, meta.canonical, meta.ogTitle, meta.ogDescription, meta.ogImage, meta.twitterCard],
  );
}
