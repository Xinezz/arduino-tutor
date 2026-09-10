// The virtual Arduino board: owns all hardware state (pin modes, pin output
// levels, which components are wired to which pins, which buttons are
// currently held down) and draws it as an SVG. The interpreter never touches
// the DOM directly - it only calls the small API this module exposes
// (pinMode/digitalWrite/digitalRead), which keeps the "language" and the
// "hardware" cleanly separated, the same way real firmware is separated from
// the physical chip it runs on.

const DIGITAL_PINS = Array.from({ length: 14 }, (_, i) => i); // 0-13

const PIN_X_START = 90;
const PIN_X_STEP = 42;
const PIN_Y = 70;
const BOARD_X = 40, BOARD_Y = 40, BOARD_W = 680, BOARD_H = 150;
const TRAY_Y = 240;

export function createBoard(svgEl, consoleEl) {
  let pinModes = {};     // pin -> "OUTPUT" | "INPUT" | "INPUT_PULLUP"
  let pinOutputs = {};   // pin -> 0 | 1  (last value written by digitalWrite)
  let components = [];   // { id, kind: "led"|"button", pin: number|null, x, y }
  let wires = [];        // { from: connectorId, to: connectorId }
  let pressed = new Set(); // component ids of currently-held-down buttons
  let pending = null;    // connectorId waiting for its second endpoint
  let nextComponentNum = { led: 1, button: 1 };

  function reset() {
    pinModes = {};
    pinOutputs = {};
    render();
  }

  // ---------- hardware API used by the interpreter ----------

  function pinMode(pin, mode) {
    pinModes[pin] = mode;
    renderComponents();
  }

  function digitalWrite(pin, value) {
    pinOutputs[pin] = value ? 1 : 0;
    renderComponents();
  }

  function digitalRead(pin) {
    const mode = pinModes[pin];
    const button = components.find(
      (c) => c.kind === "button" && isButtonWiredToPin(c, pin)
    );
    const isPressed = button && pressed.has(button.id);

    if (mode === "INPUT_PULLUP") return isPressed ? 0 : 1; // default HIGH, LOW when pressed
    if (mode === "INPUT") return isPressed ? 1 : 0;         // default LOW, HIGH when pressed (simple pull-down wiring)
    return pinOutputs[pin] ?? 0; // reading back an OUTPUT pin just returns what was last written
  }

  // ---------- wiring helpers ----------

  function connectorPoint(id) {
    if (id === "gnd") return { x: 60, y: PIN_Y };
    if (id === "5v") return { x: 60, y: PIN_Y + 20 };
    if (id.startsWith("pin-")) {
      const pin = Number(id.slice(4));
      return { x: PIN_X_START + pin * PIN_X_STEP, y: PIN_Y };
    }
    const comp = components.find((c) => id.startsWith(c.id + "-"));
    if (!comp) return { x: 0, y: 0 };
    const lead = id.endsWith("-a") || id.endsWith("-1") ? -14 : 14;
    return { x: comp.x + lead, y: comp.y + (comp.kind === "led" ? 40 : 30) };
  }

  function otherEndsOf(connectorId) {
    return wires
      .filter((w) => w.from === connectorId || w.to === connectorId)
      .map((w) => (w.from === connectorId ? w.to : w.from));
  }

  function wiredPinOf(connectorId) {
    for (const other of otherEndsOf(connectorId)) {
      if (other.startsWith("pin-")) return Number(other.slice(4));
    }
    return null;
  }

  function isWiredToGnd(connectorId) {
    return otherEndsOf(connectorId).includes("gnd");
  }

  function ledConnectedPin(led) {
    return isWiredToGnd(led.id + "-k") ? wiredPinOf(led.id + "-a") : null;
  }

  function isButtonWiredToPin(btn, pin) {
    const leads = [btn.id + "-1", btn.id + "-2"];
    const pinLead = leads.find((l) => wiredPinOf(l) === pin);
    const otherLead = leads.find((l) => l !== pinLead);
    if (!pinLead) return false;
    return isWiredToGnd(otherLead) || otherEndsOf(otherLead).includes("5v");
  }

  // ---------- component management ----------

  function addComponent(kind) {
    const num = nextComponentNum[kind]++;
    const id = `${kind}-${num}`;
    const index = components.filter((c) => c.kind === kind).length;
    const x = 90 + index * 110;
    components.push({ id, kind, x, y: TRAY_Y });
    render();
  }

  function clearWiring() {
    wires = [];
    pending = null;
    render();
  }

  function removeWire(wire) {
    wires = wires.filter((w) => w !== wire);
    render();
  }

  // ---------- rendering ----------

  function svgEl_(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function handleConnectorClick(id) {
    if (pending === id) { pending = null; render(); return; }
    if (pending === null) { pending = id; render(); return; }
    wires.push({ from: pending, to: id });
    pending = null;
    render();
  }

  function render() {
    svgEl.innerHTML = "";

    // board body
    svgEl.appendChild(svgEl_("rect", {
      x: BOARD_X, y: BOARD_Y, width: BOARD_W, height: BOARD_H,
      rx: 10, fill: "#1c3d5a", stroke: "#0d2338", "stroke-width": 2,
    }));
    const label = svgEl_("text", { x: BOARD_X + 16, y: BOARD_Y + BOARD_H - 14, fill: "#7fb8e0", "font-size": 13, "font-family": "monospace" });
    label.textContent = "ARDUINO UNO (simulated)";
    svgEl.appendChild(label);

    // GND / 5V connectors
    drawConnector("gnd", 60, PIN_Y, "GND", "#9aa0b4");
    drawConnector("5v", 60, PIN_Y + 20, "5V", "#e8c547");

    // digital pin header
    for (const pin of DIGITAL_PINS) {
      const x = PIN_X_START + pin * PIN_X_STEP;
      drawConnector(`pin-${pin}`, x, PIN_Y, String(pin), "#4fc3f7");
    }

    // wires (drawn under components/pins so connector dots stay clickable)
    for (const wire of wires) {
      const p1 = connectorPoint(wire.from);
      const p2 = connectorPoint(wire.to);
      const path = svgEl_("path", {
        d: `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + 60}, ${p2.x} ${p2.y + 60}, ${p2.x} ${p2.y}`,
        fill: "none", stroke: "#57d38c", "stroke-width": 2.5, "stroke-linecap": "round",
        class: "sim-wire",
      });
      path.addEventListener("click", () => removeWire(wire));
      svgEl.appendChild(path);
    }

    // components
    for (const comp of components) {
      if (comp.kind === "led") drawLed(comp);
      else drawButton(comp);
    }

    // re-draw connectors on top so they stay clickable even under wires
    drawConnector("gnd", 60, PIN_Y, "GND", "#9aa0b4", true);
    drawConnector("5v", 60, PIN_Y + 20, "5V", "#e8c547", true);
    for (const pin of DIGITAL_PINS) {
      drawConnector(`pin-${pin}`, PIN_X_START + pin * PIN_X_STEP, PIN_Y, String(pin), "#4fc3f7", true);
    }
    for (const comp of components) {
      const leads = comp.kind === "led" ? ["-a", "-k"] : ["-1", "-2"];
      for (const suffix of leads) {
        const id = comp.id + suffix;
        const p = connectorPoint(id);
        drawConnector(id, p.x, p.y, "", "#e4e6ec", true, 4);
      }
    }

    if (consoleEl) renderConsoleHint();
  }

  function drawConnector(id, x, y, text, color, topLayer, radius) {
    const r = radius || 7;
    const isPending = pending === id;

    // The visible dot is deliberately small (so the board reads cleanly), but
    // a small circle is a poor click target - so a larger, invisible circle
    // underneath it is what actually catches the click/tap.
    const hitArea = svgEl_("circle", {
      cx: x, cy: y, r: r + 8, fill: "transparent", class: "sim-connector-hit",
    });
    hitArea.addEventListener("click", () => handleConnectorClick(id));
    svgEl.appendChild(hitArea);

    const circle = svgEl_("circle", {
      cx: x, cy: y, r, fill: isPending ? "#fff" : color,
      stroke: isPending ? "#fff" : "#0d2338", "stroke-width": isPending ? 2 : 1,
      class: "sim-connector", style: "pointer-events:none",
    });
    svgEl.appendChild(circle);
    if (text && !topLayer) {
      const t = svgEl_("text", { x, y: y - 14, fill: "#9aa0b4", "font-size": 11, "text-anchor": "middle", "font-family": "monospace" });
      t.textContent = text;
      svgEl.appendChild(t);
    }
  }

  function drawLed(led) {
    const pin = ledConnectedPin(led);
    const isLit = pin !== null && pinModes[pin] === "OUTPUT" && pinOutputs[pin] === 1;
    const g = svgEl_("g", {});
    const bulb = svgEl_("circle", {
      cx: led.x, cy: led.y + 20, r: 18,
      fill: isLit ? "#ffe066" : "#3a2f1a",
      stroke: isLit ? "#ffd23f" : "#5a4a2a", "stroke-width": 2,
      style: isLit ? "filter:drop-shadow(0 0 10px #ffe066)" : "",
    });
    g.appendChild(bulb);
    const leadA = svgEl_("line", { x1: led.x - 14, y1: led.y + 20, x2: led.x - 14, y2: led.y + 60, stroke: "#888", "stroke-width": 2 });
    const leadK = svgEl_("line", { x1: led.x + 14, y1: led.y + 20, x2: led.x + 14, y2: led.y + 60, stroke: "#888", "stroke-width": 2 });
    g.appendChild(leadA);
    g.appendChild(leadK);
    const label = svgEl_("text", { x: led.x, y: led.y + 90, fill: "#9aa0b4", "font-size": 10, "text-anchor": "middle", "font-family": "monospace" });
    label.textContent = pin !== null ? `LED (pin ${pin})` : "LED (unwired)";
    g.appendChild(label);
    svgEl.appendChild(g);
  }

  function drawButton(btn) {
    const isPressed = pressed.has(btn.id);
    const body = svgEl_("rect", {
      x: btn.x - 20, y: btn.y + (isPressed ? 8 : 0), width: 40, height: 30, rx: 4,
      fill: isPressed ? "#4a4f63" : "#2a2f3f", stroke: "#9aa0b4", "stroke-width": 2,
      style: "cursor:pointer",
    });
    body.addEventListener("mousedown", () => { pressed.add(btn.id); render(); });
    body.addEventListener("mouseup", () => { pressed.delete(btn.id); render(); });
    body.addEventListener("mouseleave", () => { if (pressed.has(btn.id)) { pressed.delete(btn.id); render(); } });
    svgEl.appendChild(body);
    const lead1 = svgEl_("line", { x1: btn.x - 14, y1: btn.y, x2: btn.x - 14, y2: btn.y + 30, stroke: "#888", "stroke-width": 2 });
    const lead2 = svgEl_("line", { x1: btn.x + 14, y1: btn.y, x2: btn.x + 14, y2: btn.y + 30, stroke: "#888", "stroke-width": 2 });
    svgEl.appendChild(lead1);
    svgEl.appendChild(lead2);
    const label = svgEl_("text", { x: btn.x, y: btn.y + 60, fill: "#9aa0b4", "font-size": 10, "text-anchor": "middle", "font-family": "monospace" });
    const pin = wiredPinOf(btn.id + "-1") ?? wiredPinOf(btn.id + "-2");
    label.textContent = pin !== null ? `Button (pin ${pin}) - hold to press` : "Button (unwired)";
    svgEl.appendChild(label);
  }

  function renderComponents() {
    // lightweight redraw path used during a running program (called often) -
    // full render() is cheap enough at this scale, so just reuse it.
    render();
  }

  function renderConsoleHint() {}

  render();

  return {
    pinMode, digitalWrite, digitalRead,
    addComponent, clearWiring, reset,
    getPinModesSnapshot: () => ({ ...pinModes }),
  };
}
