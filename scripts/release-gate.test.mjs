import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";

import { SITE_CONFIG, runReleaseGate, buildAssertions } from "./release-gate.mjs";

function mockPayloadFor(checkId) {
  const check = SITE_CONFIG.checks.find(check => check.id === checkId);
  if (checkId.startsWith("route-historical-")) return {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: '<!doctype html><html><head><meta name="robots" content="index,follow"><link rel="canonical" href="' + check.expect.canonical + '"></head><body>' + check.expect.bodyIncludes.map(part => '<p>' + part + '</p>').join('') + '</body></html>',
  };
  if (checkId.startsWith("route-excluded-proposal-")) return {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, follow" },
    body: '<!doctype html><html><head><meta name="robots" content="noindex,follow"></head><body><div id="root"></div></body></html>',
  };
  if (checkId === "route-sitemap") return {
    status: 200,
    headers: { "content-type": "application/xml" },
    body: '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + check.expect.sitemapUrls.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>',
  };
  switch (checkId) {
    case "route-messenger-redirect":
    case "route-chirpy-redirect":
      return {
        status: 308,
        headers: { location: "https://chat.bittrees.org" },
        body: "Redirecting to Chat",
      };
    case "route-not-found":
      return {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: '<!doctype html><html><head><meta name="robots" content="noindex,follow"></head><body><h1>Page not found</h1></body></html>',
      };
    case "api-community":
      return {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          roles: {},
          roledefs: [],
          flags: {},
          enckeys: {},
          threshold: 2,
        }),
      };
    case "api-rooms":
      return {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          rooms: {},
          custom: [],
          proposals: [],
          icons: {},
        }),
      };
    case "api-usersync":
      return {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ blob: null, updatedAt: 0 }),
      };
    case "api-gate":
      return {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "invalid address" }),
      };
    default:
      return {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: "<!doctype html><html><body><div id=\"root\"></div></body></html>",
      };
  }
}

async function startServer(overrides = {}) {
  const routeByPath = new Map(SITE_CONFIG.checks.map((check) => [check.path, check]));
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const check =
      routeByPath.get(requestUrl.pathname === "/api/usersync" ? `${requestUrl.pathname}${requestUrl.search}` : requestUrl.pathname) ||
      routeByPath.get(requestUrl.pathname);
    if (!check) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }

    const payload = overrides[check.id] ?? mockPayloadFor(check.id);
    response.writeHead(payload.status, payload.headers);
    response.end(payload.body);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    async close() {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

test("baseline mode captures a passing snapshot", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "gov-release-gate-"));
  const server = await startServer();
  try {
    const run = await runReleaseGate({
      mode: "baseline",
      baseUrl: server.baseUrl,
      outputDir,
      timeoutMs: 5000,
    });
    assert.equal(run.pass, true);
    for (const id of ["route-messenger-redirect", "route-chirpy-redirect"]) {
      const result = run.results.find((item) => item.id === id);
      assert.equal(result.status, 308, "the gate must observe the Gov response without following external Chat");
      assert.equal(result.headers.location, "https://chat.bittrees.org");
      assert(result.assertions.some((item) => item.kind === "header" && item.pass));
    }
    assert.equal(run.results.find((item) => item.id === "route-not-found").status, 404);
    assert.match(run.artifacts.jsonPath, /run\.json$/);
    assert.match(run.artifacts.reportPath, /report\.md$/);
  } finally {
    await server.close();
  }
});

test("redirect checks reject an HTML success response and an incorrect destination", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "gov-release-gate-"));
  const server = await startServer({
    "route-messenger-redirect": {
      status: 200,
      headers: { "content-type": "text/html", location: "https://chat.bittrees.org" },
      body: "A successful page is not the required redirect",
    },
    "route-chirpy-redirect": {
      status: 308,
      headers: { location: "https://unexpected.invalid/chat" },
      body: "Wrong destination",
    },
  });
  try {
    const run = await runReleaseGate({ mode: "baseline", baseUrl: server.baseUrl, outputDir, timeoutMs: 5000 });
    assert.equal(run.pass, false);
    const messenger = run.results.find((item) => item.id === "route-messenger-redirect");
    assert(messenger.assertions.some((item) => item.kind === "status" && !item.pass && item.actual === 200));
    const chirpy = run.results.find((item) => item.id === "route-chirpy-redirect");
    assert.equal(chirpy.status, 308, "a wrong redirect target must not be fetched");
    assert(chirpy.assertions.some((item) => item.kind === "header" && !item.pass && item.actual === "https://unexpected.invalid/chat"));
  } finally {
    await server.close();
  }
});

test("unknown routes cannot pass as a successful SPA fallback", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "gov-release-gate-"));
  const server = await startServer({
    "route-not-found": {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: '<!doctype html><html><body><div id="root"></div></body></html>',
    },
  });
  try {
    const run = await runReleaseGate({ mode: "baseline", baseUrl: server.baseUrl, outputDir, timeoutMs: 5000 });
    assert.equal(run.pass, false);
    const result = run.results.find((item) => item.id === "route-not-found");
    assert(result.assertions.some((item) => item.kind === "status" && !item.pass && item.expected === 404));
  } finally {
    await server.close();
  }
});

test("historical routes reject empty successful shells and a sitemap with unreviewed records", async () => {
  const archived = SITE_CONFIG.checks.find(check => check.id.startsWith('route-historical-'));
  const sitemap = mockPayloadFor('route-sitemap');
  const outputDir = await mkdtemp(path.join(tmpdir(), 'gov-archive-gate-'));
  const server = await startServer({
    [archived.id]: { status: 200, headers: { 'content-type': 'text/html' }, body: '<html><body><div id="root"></div></body></html>' },
    'route-sitemap': { ...sitemap, body: sitemap.body.replace('</urlset>', '<url><loc>https://gov.bittrees.org/proposals/new</loc></url></urlset>') },
  });
  try {
    const run = await runReleaseGate({ mode: 'baseline', baseUrl: server.baseUrl, outputDir, timeoutMs: 5000 });
    assert.equal(run.pass, false);
    assert(run.results.find(result => result.id === archived.id).assertions.some(item => item.kind === 'body-content' && !item.pass));
    assert(run.results.find(result => result.id === 'route-sitemap').assertions.some(item => item.kind === 'sitemap-cohort' && !item.pass));
  } finally { await server.close(); }
});

test("public record checks reject production noindex, duplicate canonicals and bot-scoped exclusions", () => {
  const check = SITE_CONFIG.checks.find(check => check.id.startsWith('route-historical-'));
  const fixture = mockPayloadFor(check.id);
  const payload = { ...fixture, contentType: 'text/html', url: 'https://gov.bittrees.org' + check.path };
  assert(buildAssertions(check, payload, fixture.body).every(item => item.pass));
  const blocked = { ...payload, headers: { ...payload.headers, 'x-robots-tag': 'googlebot: noindex' } };
  assert(buildAssertions(check, blocked, fixture.body).some(item => item.kind === 'index-policy' && !item.pass));
  const preview = { ...blocked, url: 'https://gov-preview.vercel.app' + check.path };
  assert(buildAssertions(check, preview, fixture.body).every(item => item.pass));
  const hidden = fixture.body.replace('</head>', '<meta name="googlebot" content="none"></head>');
  assert(buildAssertions(check, preview, hidden).some(item => item.kind === 'index-policy' && !item.pass));
  const duplicate = fixture.body.replace('</head>', '<link rel="canonical" href="https://gov.bittrees.org/"></head>');
  assert(buildAssertions(check, payload, duplicate).some(item => item.kind === 'canonical' && !item.pass));
});

test("the sitemap gate rejects HTML wrappers, foreign namespaces and hidden extra XML content", () => {
  const check = SITE_CONFIG.checks.find(check => check.id === 'route-sitemap');
  const fixture = mockPayloadFor(check.id);
  const payload = { ...fixture, contentType: 'application/xml', url: 'https://gov.bittrees.org/sitemap.xml' };
  assert(buildAssertions(check, payload, fixture.body).every(item => item.pass));
  for (const body of [
    '<html>' + fixture.body.replace('http://www.sitemaps.org/schemas/sitemap/0.9', 'https://example.invalid/not-sitemaps') + '</html>',
    fixture.body.replace('http://www.sitemaps.org/schemas/sitemap/0.9', 'https://example.invalid/not-sitemaps'),
    fixture.body.replace('</urlset>', '<![CDATA[<url><loc>https://gov.bittrees.org/proposals/new</loc></url>]]></urlset>'),
  ]) assert(buildAssertions(check, payload, body).some(item => item.kind === 'sitemap-cohort' && !item.pass));
});

test("canary mode detects contract drift against a saved baseline", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "gov-release-gate-"));
  const healthyServer = await startServer();
  const brokenServer = await startServer({
    "api-gate": {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "boom" }),
    },
  });

  try {
    const baseline = await runReleaseGate({
      mode: "baseline",
      baseUrl: healthyServer.baseUrl,
      outputDir,
      timeoutMs: 5000,
    });
    const canary = await runReleaseGate({
      mode: "canary",
      baseUrl: brokenServer.baseUrl,
      baselineFile: baseline.artifacts.jsonPath,
      outputDir,
      timeoutMs: 5000,
    });
    assert.equal(canary.pass, false);
    assert.ok(
      canary.comparison.diffs.some((diff) => diff.id === "api-gate"),
      "expected api-gate drift to be reported",
    );
  } finally {
    await healthyServer.close();
    await brokenServer.close();
  }
});

test("rollback-check passes when production matches the saved baseline", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "gov-release-gate-"));
  const server = await startServer();
  try {
    const baseline = await runReleaseGate({
      mode: "baseline",
      baseUrl: server.baseUrl,
      outputDir,
      timeoutMs: 5000,
    });
    const rollback = await runReleaseGate({
      mode: "rollback-check",
      baseUrl: server.baseUrl,
      baselineFile: baseline.artifacts.jsonPath,
      outputDir,
      timeoutMs: 5000,
    });
    assert.equal(rollback.pass, true);
  } finally {
    await server.close();
  }
});
