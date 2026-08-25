import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class FakeControl {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  click() {
    this.listeners.get("click")?.();
  }
}

class FakeElement {
  constructor(tagName, registerElement) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.className = "";
    this.id = "";
    this.registerElement = registerElement;
    this.retryButton = null;
    this._innerHTML = "";
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.retryButton = value.includes("data-site-load-retry")
      ? new FakeControl()
      : null;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  querySelector(selector) {
    return selector === "[data-site-load-retry]" ? this.retryButton : null;
  }

  prepend(element) {
    this.children.unshift(element);
    if (element.id) this.registerElement(element);
  }
}

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const functionMatch = source.match(
  /^function renderSiteLoadFailure\(\) \{[\s\S]*?^\}/m
);

assert.ok(functionMatch, "shared load-failure renderer was not found");
assert.match(
  source,
  /\.catch\(error => \{\s*console\.error\("TLPT site load failed:", error\);\s*renderSiteLoadFailure\(\);\s*\}\);/,
  "shared startup catch must render the visitor-facing failure state"
);

const elements = new Map();
const registerElement = element => elements.set(element.id, element);
const mainContent = new FakeElement("main", registerElement);
mainContent.id = "main-content";
registerElement(mainContent);

const document = {
  createElement(tagName) {
    return new FakeElement(tagName, registerElement);
  },
  getElementById(id) {
    return elements.get(id) || null;
  }
};

let reloadCount = 0;
const window = {
  location: {
    reload() {
      reloadCount += 1;
    }
  }
};

const context = { document, window };
vm.runInNewContext(
  `${functionMatch[0]}\nglobalThis.renderSiteLoadFailure = renderSiteLoadFailure;`,
  context
);

const failurePanel = context.renderSiteLoadFailure();
assert.ok(failurePanel, "failure panel was not created");
assert.equal(failurePanel.id, "site-load-error", "failure panel id changed");
assert.equal(failurePanel.className, "section", "failure panel must reuse shared panel styling");
assert.equal(failurePanel.getAttribute("role"), "alert", "failure panel must announce itself");
assert.equal(
  failurePanel.getAttribute("aria-labelledby"),
  "site-load-error-title",
  "failure panel accessible name changed"
);
assert.match(failurePanel.innerHTML, /The Cards Didn’t Load/);
assert.match(failurePanel.innerHTML, /The latest league data couldn’t be loaded\./);
assert.match(failurePanel.innerHTML, /type="button" data-site-load-retry/);
assert.match(failurePanel.innerHTML, /href="\/index\.html">Return Home/);
assert.equal(mainContent.children[0], failurePanel, "failure panel must lead the page content");

failurePanel.retryButton.click();
assert.equal(reloadCount, 1, "Try Again must reload the current page");

const repeatedPanel = context.renderSiteLoadFailure();
assert.equal(repeatedPanel, failurePanel, "repeated failures must reuse the existing panel");
assert.equal(mainContent.children.length, 1, "repeated failures must not duplicate the panel");

elements.delete("site-load-error");
elements.delete("main-content");
assert.equal(
  context.renderSiteLoadFailure(),
  null,
  "missing main content must fail safely without creating detached recovery UI"
);

const integrationElements = new Map();
const registerIntegrationElement = element => integrationElements.set(element.id, element);
const integrationMain = new FakeElement("main", registerIntegrationElement);
integrationMain.id = "main-content";
registerIntegrationElement(integrationMain);

let domReadyHandler = null;
const integrationDocument = {
  addEventListener(type, handler) {
    if (type === "DOMContentLoaded") domReadyHandler = handler;
  },
  createElement(tagName) {
    return new FakeElement(tagName, registerIntegrationElement);
  },
  getElementById(id) {
    return integrationElements.get(id) || null;
  },
  querySelectorAll() {
    return [];
  }
};

const loggedErrors = [];
const integrationContext = {
  console: {
    error(...args) {
      loggedErrors.push(args);
    }
  },
  document: integrationDocument,
  fetch: async () => ({ ok: false, status: 503 }),
  URL,
  URLSearchParams,
  window: {
    location: {
      reload() {}
    }
  }
};

vm.runInNewContext(source, integrationContext);
assert.equal(typeof domReadyHandler, "function", "shared app startup handler was not registered");
domReadyHandler();
await new Promise(resolve => setImmediate(resolve));

const integratedPanel = integrationElements.get("site-load-error");
assert.ok(integratedPanel, "an HTTP data failure must render the recovery panel");
assert.equal(integrationMain.children[0], integratedPanel, "startup recovery must lead page content");
assert.equal(loggedErrors.length, 1, "startup failure must retain one diagnostic console error");
assert.equal(
  loggedErrors[0][0],
  "TLPT site load failed:",
  "startup failure diagnostic label changed"
);

console.log("PASS: shared app data-load recovery behavior");
