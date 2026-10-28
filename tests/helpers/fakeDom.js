// Just enough of the DOM for js/simulator/board.js to run in Node: it only
// ever creates SVG elements, sets attributes/text, appends children, adds
// event listeners, and clears its <svg> with innerHTML = "".

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this.textContent = "";
    this.style = {};
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener() {}
  set innerHTML(_value) { this.children = []; }
  get innerHTML() { return ""; }
}

export function createFakeSvg() {
  if (!globalThis.document) {
    globalThis.document = { createElementNS: (_ns, tag) => new FakeElement(tag) };
  }
  return new FakeElement("svg");
}
