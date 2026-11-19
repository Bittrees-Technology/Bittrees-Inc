import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { historicalProposals, proposalPath } from "../src/lib/proposalArchive.ts";
import { indexablePages, SITE_URL } from "../src/lib/seo.ts";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SNAPSHOT_HEADERS = [
  "content-type",
  "cache-control",
  "last-modified",
  "etag",
  "x-robots-tag",
  "location",
];

export const SITE_CONFIG = {
  site: "gov",
  productionBaseUrl: "https://gov.bittrees.org",
  checks: [
    {
      id: "route-root",
      label: "Root route",
      path: "/",
      kind: "route",
      expect: { status: 200, contentTypeIncludes: "text/html" },
      signature: [{ type: "header", key: "content-type" }],
    },
    {
      id: "route-proposals",
      label: "Proposals route",
      path: "/proposals",
      kind: "route",
      expect: { status: 200, contentTypeIncludes: "text/html" },
      signature: [{ type: "header", key: "content-type" }],
    },
    {
      id: "route-forum",
      label: "Forum route",
      path: "/forum",
      kind: "route",
      expect: { status: 200, contentTypeIncludes: "text/html" },
      signature: [{ type: "header", key: "content-type" }],
    },
    ...historicalProposals.map(entry => ({
      id: "route-historical-" + entry.snapshot.id,
      label: entry.snapshot.title.trim(),
      path: proposalPath(entry.snapshot.id),
      kind: "route",
      expect: {
        status: 200,
        contentTypeIncludes: "text/html",
        indexable: true,
        canonical: SITE_URL + proposalPath(entry.snapshot.id),
        bodyIncludes: [entry.snapshot.title.trim(), entry.sourceUrl, entry.snapshot.id, entry.snapshot.body.slice(0, 100), "Original proposal text", "does not establish that the proposal was implemented"],
      },
      signature: [{ type: "header", key: "content-type" }],
    })),
    ...["/proposals/new", "/proposals/0x" + "f".repeat(64)].map((path, i) => ({
      id: "route-excluded-proposal-" + i,
      label: i === 0 ? "Proposal creation remains excluded" : "Unreviewed proposal remains excluded",
      path,
      kind: "route",
      expect: { status: 200, contentTypeIncludes: "text/html", noindex: true },
      signature: [{ type: "header", key: "x-robots-tag" }],
    })),
    {
      id: "route-sitemap",
      label: "Reviewed public sitemap cohort",
      path: "/sitemap.xml",
      kind: "route",
      expect: { status: 200, contentTypeIncludes: "xml", sitemapUrls: Object.keys(indexablePages).map(path => SITE_URL + path) },
      signature: [{ type: "header", key: "content-type" }],
    },
    {
      id: "route-messenger-redirect",
      label: "Legacy Messenger redirect",
      path: "/messenger",
      kind: "route",
      redirect: "manual",
      expect: { status: 308, headers: { location: "https://chat.bittrees.org" } },
      signature: [{ type: "header", key: "location" }],
    },
    {
      id: "route-chirpy-redirect",
      label: "Legacy Chirpy redirect",
      path: "/chirpy",
      kind: "route",
      redirect: "manual",
      expect: { status: 308, headers: { location: "https://chat.bittrees.org" } },
      signature: [{ type: "header", key: "location" }],
    },
    {
      id: "route-not-found",
      label: "Unknown route",
      path: "/__seo_release_gate_missing__",
      kind: "route",
      redirect: "manual",
      expect: { status: 404, contentTypeIncludes: "text/html" },
      signature: [{ type: "header", key: "content-type" }],
    },
    {
      id: "route-contribute",
      label: "Contribute route",
      path: "/contribute",
      kind: "route",
      expect: { status: 200, contentTypeIncludes: "text/html" },
      signature: [{ type: "header", key: "content-type" }],
    },
    {
      id: "route-admin",
      label: "Admin route",
      path: "/admin",
      kind: "route",
      expect: { status: 200, contentTypeIncludes: "text/html" },
      signature: [{ type: "header", key: "content-type" }],
    },
    {
      id: "api-community",
      label: "Community registry",
      path: "/api/community",
      kind: "api",
      expect: {
        status: 200,
        contentTypeIncludes: "application/json",
        json: [
          { path: "roles", type: "object" },
          { path: "roledefs", type: "array" },
          { path: "flags", type: "object" },
          { path: "enckeys", type: "object" },
          { path: "threshold", type: "number" },
        ],
      },
      signature: [
        { type: "header", key: "content-type" },
        { type: "json-type", path: "roles" },
        { type: "json-type", path: "roledefs" },
        { type: "json-type", path: "flags" },
        { type: "json-type", path: "enckeys" },
        { type: "json-type", path: "threshold" },
      ],
    },
    {
      id: "api-rooms",
      label: "Room registry",
      path: "/api/rooms",
      kind: "api",
      expect: {
        status: 200,
        contentTypeIncludes: "application/json",
        json: [
          { path: "rooms", type: "object" },
          { path: "custom", type: "array" },
          { path: "proposals", type: "array" },
          { path: "icons", type: "object" },
        ],
      },
      signature: [
        { type: "header", key: "content-type" },
        { type: "json-type", path: "rooms" },
        { type: "json-type", path: "custom" },
        { type: "json-type", path: "proposals" },
        { type: "json-type", path: "icons" },
      ],
    },
    {
      id: "api-usersync",
      label: "User sync probe",
      path: `/api/usersync?address=${ZERO_ADDRESS}`,
      kind: "api",
      expect: {
        status: 200,
        contentTypeIncludes: "application/json",
        json: [
          { path: "blob", equals: null },
          { path: "updatedAt", type: "number" },
        ],
      },
      signature: [
        { type: "header", key: "content-type" },
        { type: "json-value", path: "blob" },
        { type: "json-type", path: "updatedAt" },
      ],
    },
    {
      id: "api-gate",
      label: "Gate malformed-input contract",
      path: "/api/gate",
      kind: "api",
      expect: {
        status: 400,
        contentTypeIncludes: "application/json",
        json: [{ path: "error", equals: "invalid address" }],
      },
      signature: [
        { type: "header", key: "content-type" },
        { type: "json-value", path: "error" },
      ],
    },
  ],
  rollbackNotes: [
    "Restore the last known-good Vercel deployment for gov.bittrees.org from deployment history.",
    "Re-run this gate in rollback-check mode against the saved baseline artifact before reopening traffic.",
    "If /api/community or /api/rooms still regresses after rollback, treat it as a KV or env incident rather than repeating code flips.",
  ],
};

function parseArgs(argv) {
  const args = {
    mode: "baseline",
    baseUrl: SITE_CONFIG.productionBaseUrl,
    outputDir: path.resolve("output", "release-gates"),
    timeoutMs: 15000,
    baselineFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${token}`);
    }
    const [flag, inlineValue] = token.split("=", 2);
    const value =
      inlineValue ?? (index + 1 < argv.length ? argv[++index] : undefined);
    switch (flag) {
      case "--mode":
        args.mode = value;
        break;
      case "--base-url":
        args.baseUrl = value;
        break;
      case "--baseline":
        args.baselineFile = value;
        break;
      case "--output-dir":
        args.outputDir = path.resolve(value);
        break;
      case "--timeout-ms":
        args.timeoutMs = Number(value);
        break;
      case "--help":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  return args;
}

function printUsage() {
  console.log(`Usage: node scripts/release-gate.mjs [options]

Modes:
  baseline       Capture a read-only production backup snapshot
  canary         Validate a supplied canary or preview URL
  rollback-check Validate current production against a saved baseline

Options:
  --mode <baseline|canary|rollback-check>
  --base-url <url>        Target URL for baseline or canary checks
  --baseline <file>       Prior run.json artifact used for canary diff or rollback verification
  --output-dir <dir>      Artifact directory (default: output/release-gates)
  --timeout-ms <ms>       Per-request timeout (default: 15000)
`);
}

function normaliseBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function urlFor(baseUrl, resourcePath) {
  return new URL(resourcePath, `${normaliseBaseUrl(baseUrl)}/`).toString();
}

function readPath(input, dottedPath) {
  return dottedPath
    .split(".")
    .reduce(
      (current, segment) =>
        current !== null && current !== undefined ? current[segment] : undefined,
      input,
    );
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function truncate(value, maxLength = 400) {
  if (typeof value !== "string") return value;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export function buildAssertions(check, payload, bodyText = "") {
  const assertions = [];
  const expect = check.expect ?? {};

  if (expect.status !== undefined) {
    assertions.push({
      kind: "status",
      pass: payload.status === expect.status,
      expected: expect.status,
      actual: payload.status,
      message: `status ${payload.status}`,
    });
  }

  if (expect.contentTypeIncludes) {
    assertions.push({
      kind: "content-type",
      pass: payload.contentType.includes(expect.contentTypeIncludes),
      expected: expect.contentTypeIncludes,
      actual: payload.contentType || "(missing)",
      message: `content-type ${payload.contentType || "(missing)"}`,
    });
  }

  for (const [key, expected] of Object.entries(expect.headers ?? {})) {
    const actual = payload.headers[key.toLowerCase()] || "";
    assertions.push({
      kind: "header",
      pass: actual === expected,
      expected,
      actual: actual || "(missing)",
      message: `${key}=${actual || "(missing)"}`,
    });
  }

  for (const required of expect.bodyIncludes ?? []) {
    assertions.push({ kind: "body-content", pass: bodyText.includes(required), expected: required, message: "Required historical content: " + required });
  }

  const attribute = (tag, name) => tag.match(new RegExp("\\b" + name + "\\s*=\\s*(['\"])(.*?)\\1", "i"))?.[2] ?? "";
  if (expect.canonical) {
    const canonicals = [...bodyText.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]).filter(tag => attribute(tag, "rel").toLowerCase() === "canonical").map(tag => attribute(tag, "href"));
    assertions.push({ kind: "canonical", pass: canonicals.length === 1 && canonicals[0] === expect.canonical, expected: expect.canonical, actual: canonicals, message: "One exact public record canonical" });
  }
  if (expect.indexable || expect.noindex) {
    const noindex = value => /(?:^|[\s,:;])(?:noindex|none)(?:$|[\s,;])/i.test(value);
    const meta = [...bodyText.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).filter(tag => /^(?:robots|googlebot(?:-news)?|bingbot)$/i.test(attribute(tag, "name"))).some(tag => noindex(attribute(tag, "content")));
    const header = noindex(payload.headers["x-robots-tag"] ?? "");
    const production = new URL(payload.url).hostname === new URL(SITE_CONFIG.productionBaseUrl).hostname;
    // Vercel may add its own noindex header to previews. Public HTML must still
    // be indexable there, while production must have neither exclusion.
    const pass = expect.indexable ? !meta && (!production || !header) : meta || header;
    assertions.push({ kind: "index-policy", pass, expected: expect.indexable ? "public historical content" : "excluded workspace", actual: { metaNoindex: meta, headerNoindex: header, production }, message: "Record/workspace index policy" });
  }
  if (expect.sitemapUrls) {
    const urls = [...bodyText.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(match => match[1].trim());
    const expected = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + expect.sitemapUrls.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>';
    const normalize = text => text.trim().replace(/>\s+</g, '><');
    // Compare the complete deterministic artifact, not just a loc regex: HTML,
    // a foreign XML namespace, extra nodes and CDATA must not masquerade as it.
    const pass = normalize(bodyText) === expected;
    assertions.push({ kind: "sitemap-cohort", pass, expected: expect.sitemapUrls, actual: urls, message: "Only current reviewed public URLs in sitemap" });
  }

  for (const jsonAssertion of expect.json ?? []) {
    const actual = readPath(payload.json, jsonAssertion.path);
    if (Object.prototype.hasOwnProperty.call(jsonAssertion, "equals")) {
      assertions.push({
        kind: "json-equals",
        pass: Object.is(actual, jsonAssertion.equals),
        expected: jsonAssertion.equals,
        actual,
        message: `${jsonAssertion.path}=${JSON.stringify(actual)}`,
      });
      continue;
    }

    if (jsonAssertion.type) {
      const actualType = valueType(actual);
      assertions.push({
        kind: "json-type",
        pass: actualType === jsonAssertion.type,
        expected: jsonAssertion.type,
        actual: actualType,
        message: `${jsonAssertion.path}:${actualType}`,
      });
    }
  }

  return assertions;
}

function buildSignature(check, payload) {
  return (check.signature ?? []).map((part) => {
    if (part.type === "header") {
      return `${part.key}=${payload.headers[part.key] || ""}`;
    }
    if (part.type === "json-type") {
      return `${part.path}:${valueType(readPath(payload.json, part.path))}`;
    }
    if (part.type === "json-value") {
      return `${part.path}=${JSON.stringify(readPath(payload.json, part.path))}`;
    }
    return `${part.type}=unsupported`;
  });
}

async function fetchCheck(baseUrl, check, timeoutMs) {
  const targetUrl = urlFor(baseUrl, check.path);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      headers: { accept: "application/json,text/html;q=0.9,*/*;q=0.8" },
      ...(check.redirect ? { redirect: check.redirect } : {}),
      signal: controller.signal,
    });
    const bodyText = await response.text();
    const headers = Object.fromEntries(
      SNAPSHOT_HEADERS.map((key) => [key, response.headers.get(key) || ""]).filter(
        ([, value]) => value,
      ),
    );
    const contentType = response.headers.get("content-type") || "";
    let json = null;

    if (contentType.includes("application/json")) {
      try {
        json = JSON.parse(bodyText);
      } catch {
        json = null;
      }
    }

    const payload = {
      id: check.id,
      label: check.label,
      kind: check.kind,
      path: check.path,
      url: targetUrl,
      status: response.status,
      contentType,
      headers,
      durationMs: Date.now() - startedAt,
      bodyPreview: truncate(bodyText),
      json,
    };
    const assertions = buildAssertions(check, payload, bodyText);
    return {
      ...payload,
      assertions,
      pass: assertions.every((assertion) => assertion.pass),
      signature: buildSignature(check, payload),
    };
  } catch (error) {
    return {
      id: check.id,
      label: check.label,
      kind: check.kind,
      path: check.path,
      url: targetUrl,
      status: null,
      contentType: "",
      headers: {},
      durationMs: Date.now() - startedAt,
      bodyPreview: "",
      json: null,
      assertions: [
        {
          kind: "fetch",
          pass: false,
          expected: "successful response",
          actual: error instanceof Error ? error.message : String(error),
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      pass: false,
      signature: ["fetch-error"],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function compareRuns(baselineRun, currentRun) {
  const baselineById = new Map(
    (baselineRun.results ?? []).map((result) => [result.id, result]),
  );
  const diffs = [];

  for (const currentResult of currentRun.results) {
    const baselineResult = baselineById.get(currentResult.id);
    if (!baselineResult) {
      diffs.push({
        id: currentResult.id,
        label: currentResult.label,
        reason: "missing-baseline-check",
      });
      continue;
    }

    if (baselineResult.status !== currentResult.status) {
      diffs.push({
        id: currentResult.id,
        label: currentResult.label,
        reason: "status-changed",
        baseline: baselineResult.status,
        current: currentResult.status,
      });
    }

    if (
      JSON.stringify(baselineResult.signature ?? []) !==
      JSON.stringify(currentResult.signature ?? [])
    ) {
      diffs.push({
        id: currentResult.id,
        label: currentResult.label,
        reason: "signature-changed",
        baseline: baselineResult.signature ?? [],
        current: currentResult.signature ?? [],
      });
    }
  }

  return {
    pass: diffs.length === 0,
    baselineSite: baselineRun.site,
    baselineMode: baselineRun.mode,
    diffs,
  };
}

function stampForFile(dateIso) {
  return dateIso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function renderReport(run) {
  const lines = [
    `# ${SITE_CONFIG.site}.bittrees.org release gate`,
    "",
    `- Site: \`${SITE_CONFIG.site}.bittrees.org\``,
    `- Mode: \`${run.mode}\``,
    `- Target URL: \`${run.targetUrl}\``,
    `- Created: \`${run.createdAt}\``,
    `- Overall result: **${run.pass ? "PASS" : "FAIL"}**`,
  ];

  if (run.baselineFile) {
    lines.push(`- Baseline artifact: \`${run.baselineFile}\``);
  }

  lines.push("");
  lines.push("| Check | Status | Pass | Signature |");
  lines.push("| --- | --- | --- | --- |");
  for (const result of run.results) {
    lines.push(
      `| ${result.label} | ${result.status ?? "ERR"} | ${result.pass ? "PASS" : "FAIL"} | \`${(result.signature ?? []).join(" ; ")}\` |`,
    );
  }

  lines.push("");
  lines.push("## Rollback notes");
  lines.push("");
  for (const note of SITE_CONFIG.rollbackNotes) {
    lines.push(`- ${note}`);
  }

  if (run.comparison) {
    lines.push("");
    lines.push("## Baseline comparison");
    lines.push("");
    lines.push(
      `- Comparison result: **${run.comparison.pass ? "PASS" : "FAIL"}**`,
    );
    if (run.comparison.diffs.length === 0) {
      lines.push("- No status or signature drift detected against the saved baseline.");
    } else {
      for (const diff of run.comparison.diffs) {
        lines.push(
          `- ${diff.label} (${diff.id}) ${diff.reason}: baseline=${JSON.stringify(diff.baseline ?? null)} current=${JSON.stringify(diff.current ?? null)}`,
        );
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

async function writeArtifacts(run, outputDir) {
  const runDir = path.join(
    outputDir,
    `${SITE_CONFIG.site}-${run.mode}-${stampForFile(run.createdAt)}`,
  );
  await mkdir(runDir, { recursive: true });
  const jsonPath = path.join(runDir, "run.json");
  const reportPath = path.join(runDir, "report.md");
  await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(run), "utf8");
  return { runDir, jsonPath, reportPath };
}

async function loadBaselineRun(baselineFile) {
  const raw = await readFile(baselineFile, "utf8");
  return JSON.parse(raw);
}

export async function runReleaseGate(options = {}) {
  const mode = options.mode ?? "baseline";
  if (!["baseline", "canary", "rollback-check"].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const targetUrl =
    mode === "rollback-check"
      ? options.baseUrl ?? SITE_CONFIG.productionBaseUrl
      : options.baseUrl ?? SITE_CONFIG.productionBaseUrl;

  const results = [];
  for (const check of SITE_CONFIG.checks) {
    results.push(await fetchCheck(targetUrl, check, options.timeoutMs ?? 15000));
  }

  const run = {
    site: SITE_CONFIG.site,
    mode,
    createdAt: new Date().toISOString(),
    targetUrl: normaliseBaseUrl(targetUrl),
    baselineFile: options.baselineFile ?? null,
    results,
    pass: results.every((result) => result.pass),
  };

  if (options.baselineFile) {
    const baselineRun = await loadBaselineRun(options.baselineFile);
    run.comparison = compareRuns(baselineRun, run);
    run.pass = run.pass && run.comparison.pass;
  }

  run.artifacts = await writeArtifacts(
    run,
    options.outputDir ?? path.resolve("output", "release-gates"),
  );

  return run;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  if (
    (args.mode === "canary" || args.mode === "rollback-check") &&
    !args.baselineFile
  ) {
    throw new Error(`${args.mode} mode requires --baseline <run.json>`);
  }

  const run = await runReleaseGate(args);
  console.log(
    `${SITE_CONFIG.site} release gate ${run.pass ? "PASS" : "FAIL"} (${run.mode})`,
  );
  console.log(`Artifacts: ${run.artifacts.runDir}`);

  if (!run.pass) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
