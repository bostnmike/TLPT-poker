import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(value) {
    this.values.add(value);
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor({ classes = [], hidden = false } = {}) {
    this.classList = new FakeClassList(classes);
    this.hidden = hidden;
    this.nextElementSibling = null;
    this.parentElement = null;
    this.removed = false;
  }

  remove() {
    this.removed = true;
  }
}

class HTMLImageElement extends FakeElement {
  constructor({
    action = "",
    classes = [],
    complete = false,
    dataHideOnError = false,
    dataset = {},
    naturalWidth = 1,
    src = ""
  } = {}) {
    super({ classes });
    this.complete = complete;
    this.dataHideOnError = dataHideOnError;
    this.dataset = { ...dataset };
    if (action) this.dataset.imageErrorAction = action;
    this.naturalWidth = naturalWidth;
    this.src = src;
  }

  matches(selector) {
    return selector.split(",").some(part => {
      const normalized = part.trim();
      if (normalized === "img[data-hide-on-error]") return this.dataHideOnError;
      if (normalized === "img[data-image-error-action]") {
        return Boolean(this.dataset.imageErrorAction);
      }
      return false;
    });
  }
}

const alreadyBroken = new HTMLImageElement({
  complete: true,
  dataHideOnError: true,
  naturalWidth: 0
});
let errorHandler = null;
let usesCapture = false;

const document = {
  addEventListener(type, handler, capture) {
    if (type === "error") {
      errorHandler = handler;
      usesCapture = capture;
    }
  },
  querySelectorAll() {
    return [alreadyBroken];
  }
};

const source = fs.readFileSync(new URL("../site-shell.js", import.meta.url), "utf8");
vm.runInNewContext(source, { document, HTMLImageElement });

assert.equal(alreadyBroken.hidden, true, "pre-failed static image should be hidden");
assert.equal(usesCapture, true, "image error listener must use capture mode");
assert.equal(typeof errorHandler, "function", "image error listener was not registered");

const emitError = image => errorHandler({ target: image });

const revealedFallback = new FakeElement({ hidden: true });
const revealImage = new HTMLImageElement({ action: "show-next" });
revealImage.nextElementSibling = revealedFallback;
emitError(revealImage);
assert.equal(revealImage.hidden, true, "show-next should hide the failed image");
assert.equal(revealedFallback.hidden, false, "show-next should reveal its sibling");

const replacementFallback = new FakeElement({ hidden: true });
const replacementImage = new HTMLImageElement({ action: "replace-with-next" });
replacementImage.nextElementSibling = replacementFallback;
emitError(replacementImage);
assert.equal(replacementImage.removed, true, "replace-with-next should remove the image");
assert.equal(replacementFallback.hidden, false, "replace-with-next should reveal its sibling");

const galleryParent = new FakeElement();
const galleryImage = new HTMLImageElement({
  action: "mark-parent",
  dataset: { imageErrorParentClass: "is-missing-avatar" }
});
galleryImage.parentElement = galleryParent;
emitError(galleryImage);
assert.equal(galleryImage.hidden, true, "mark-parent should hide the failed image");
assert.equal(
  galleryParent.classList.contains("is-missing-avatar"),
  true,
  "mark-parent should apply the configured class"
);

const sourceImage = new HTMLImageElement({
  action: "fallback-source",
  dataset: { imageFallbackSrc: "images/players/default.jpg" },
  src: "images/players/missing.jpg"
});
emitError(sourceImage);
assert.equal(sourceImage.src, "images/players/default.jpg", "fallback source was not applied");
assert.equal(sourceImage.hidden, false, "first fallback-source failure should not hide the image");
emitError(sourceImage);
assert.equal(sourceImage.hidden, true, "failed fallback source should hide the image safely");

const chipFallback = new FakeElement({ classes: ["rules-chip-fallback"] });
const chipImage = new HTMLImageElement({
  action: "candidate-list",
  dataset: { candidateIndex: "0", candidates: "chip-a.png|chip-b.png" },
  src: "chip-a.png"
});
chipImage.nextElementSibling = chipFallback;
emitError(chipImage);
assert.equal(chipImage.src, "chip-b.png", "candidate-list should advance to the next source");
assert.equal(chipImage.dataset.candidateIndex, "1", "candidate index was not updated");
emitError(chipImage);
assert.equal(chipImage.classList.contains("is-missing"), true, "exhausted chip should be marked missing");
assert.equal(chipFallback.classList.contains("is-visible"), true, "chip fallback should be shown");

const unrelated = new HTMLImageElement();
emitError(unrelated);
assert.equal(unrelated.hidden, false, "unrelated images must not be changed");

console.log("PASS: shared shell image-fallback behavior");
