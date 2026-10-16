import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../site/_worker.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../../register.html", import.meta.url), "utf8");
function gateway(fetcher) {
  const context = {URL, Response, fetch:fetcher};
  vm.runInNewContext(source.replace("export default", "globalThis.gateway ="), context);
  return context.gateway;
}

test("serves the current form with canonical assets and a branded success URL", async () => {
  let called = 0;
  const app = gateway(async (url, options) => {
    called++;
    assert.equal(url, "https://tlpt.org/register.html");
    assert.deepEqual(Object.keys(options), ["redirect"]);
    return new Response(html);
  });
  const result = await app.fetch(new Request("https://register.tlpt.org/?submitted=1", {headers:{Cookie:"private=sample"}}));
  assert.equal(result.status, 200);
  const body = await result.text();
  assert.match(body, /<base href="https:\/\/tlpt\.org\/"/);
  assert.match(body, /name="_next" value="https:\/\/register\.tlpt\.org\/\?submitted=1"/);
  assert.match(body, /action="https:\/\/formsubmit\.co\/blanchettemr@gmail\.com"/);
  assert.match(body, /register\.js\?v=20261015-5/);
  assert.match(result.headers.get("X-Robots-Tag"), /noindex/);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.equal(called, 1);
  assert.equal(await (await app.fetch(new Request("https://register.tlpt.org/", {method:"HEAD"}))).text(), "");
});

test("uses the fixed main-site origin for navigation, including protocol-like paths", async () => {
  const app = gateway(() => {throw new Error("Must not fetch");});
  for (const path of ["/index.html", "/style.css", "//outside.example/path", "/register.html/extra"]) {
    const response = await app.fetch(new Request("https://register.tlpt.org" + path));
    assert.equal(response.status, 302);
    assert.equal(new URL(response.headers.get("Location")).origin, "https://tlpt.org");
  }
  const robots = await app.fetch(new Request("https://register.tlpt.org/robots.txt"));
  assert.match(await robots.text(), /Disallow: \//);
  assert.equal((await app.fetch(new Request("https://register.tlpt.org/", {method:"POST", body:"private=sample"}))).status, 405);
});

test("fails closed for an unavailable or changed upstream form", async () => {
  for (const fetcher of [async () => new Response("Unavailable", {status:503}), async () => new Response("Wrong page"), async () => {throw new Error("Network");}]) {
    const response = await gateway(fetcher).fetch(new Request("https://register.tlpt.org/"));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});
