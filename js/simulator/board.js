// The virtual Arduino board: owns all hardware state (pin modes, pin output
// levels, which components are wired to which pins, which buttons are
// currently held down) and draws it as an SVG. The interpreter never touches
// the DOM directly - it only calls the small API this module exposes
// (pinMode/digitalWrite/digitalRead), which keeps the "language" and the
// "hardware" cleanly separated, the same way real firmware is separated from
// the physical chip it runs on.
//
// Two interaction modes, matching how you'd actually build a circuit:
//  - While NOT running: components can be dragged around the breadboard area
//    to arrange your circuit (like placing parts on a breadboard).
//  - While running: dragging is disabled, and clicking/holding a button's
//    body simulates physically pressing it instead.

const DIGITAL_PINS = Array.from({ length: 14 }, (_, i) => i); // 0-13

const PIN_X_START = 90;
const PIN_X_STEP = 42;
const PIN_Y = 70;
const BOARD_X = 40, BOARD_Y = 40, BOARD_W = 680, BOARD_H = 150;
const TRAY_TOP = BOARD_Y + BOARD_H + 30;
const TRAY_BOTTOM = 440;
const CANVAS_W = 760;

// Real prototyping wire colors: red/black are reserved for power/ground by
// convention (see autoColor below); the rest are for signal wires, picked
// automatically in rotation so multiple wires stay visually distinct even
// if you never touch the color picker.
const WIRE_PALETTE = [
  { name: "Red (power)", value: "#e2453c" },
  { name: "Black (ground)", value: "#6b7280" },
  { name: "Yellow", value: "#f5c542" },
  { name: "Blue", value: "#4fc3f7" },
  { name: "Green", value: "#57d38c" },
  { name: "Orange", value: "#ff9f4a" },
  { name: "Purple", value: "#b48ce8" },
  { name: "White", value: "#e4e6ec" },
];
const SIGNAL_ROTATION = ["#f5c542", "#4fc3f7", "#57d38c", "#ff9f4a", "#b48ce8", "#e4e6ec"];

const LED_COLORS = ["#ff5a4e", "#ffe066", "#57d38c", "#4fc3f7", "#ffffff"];

export function createBoard(svgEl) {
  let pinModes = {};     // pin -> "OUTPUT" | "INPUT" | "INPUT_PULLUP"
  let pinOutputs = {};   // pin -> 0 | 1  (last value written by digitalWrite)
  let components = [];   // { id, kind: "led"|"button", x, y, color? }
  let wires = [];        // { from: connectorId, to: connectorId, color }
  let pressed = new Set(); // component ids of currently-held-down buttons
  let pending = null;    // connectorId waiting for its second endpoint
  let nextComponentNum = { led: 1, button: 1 };
  let selectedWireColor = "auto";
  let running = false;
  let signalColorCursor = 0;

  function reset() {
    pinModes = {};
    pinOutputs = {};
    pressed = new Set();
    render();
  }

  function setRunning(value) {
    running = value;
    if (!running) pressed = new Set();
    render();
  }

  function setWireColor(color) {
    selectedWireColor = color;
  }

  // ---------- hardware API used by the interpreter ----------

  function pinMode(pin, mode) {
    pinModes[pin] = mode;
    render();
  }

  function digitalWrite(pin, value) {
    pinOutputs[pin] = value ? 1 : 0;
    render();
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
    return { x: comp.x + lead, y: comp.y + (comp.kind === "led" ? 38 : 28) };
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

  function autoColor(fromId, toId) {
    if (fromId === "gnd" || toId === "gnd") return WIRE_PALETTE[1].value; // black
    if (fromId === "5v" || toId === "5v") return WIRE_PALETTE[0].value;  // red
    const color = SIGNAL_ROTATION[signalColorCursor % SIGNAL_ROTATION.length];
    signalColorCursor++;
    return color;
  }

  // ---------- component management ----------

  function addComponent(kind) {
    const num = nextComponentNum[kind]++;
    const id = `${kind}-${num}`;
    const index = components.length;
    const x = 90 + (index % 6) * 110;
    const y = TRAY_TOP + Math.floor(index / 6) * 110;
    const comp = { id, kind, x, y };
    if (kind === "led") comp.color = LED_COLORS[(num - 1) % LED_COLORS.length];
    components.push(comp);
    render();
  }

  function removeComponent(id) {
    components = components.filter((c) => c.id !== id);
    const belongsToRemoved = (connectorId) => connectorId === id || connectorId.startsWith(id + "-");
    wires = wires.filter((w) => !belongsToRemoved(w.from) && !belongsToRemoved(w.to));
    render();
  }

  function cycleLedColor(led) {
    const i = LED_COLORS.indexOf(led.color);
    led.color = LED_COLORS[(i + 1) % LED_COLORS.length];
    render();
  }

  function clearWiring() {
    wires = [];
    pending = null;
    signalColorCursor = 0;
    render();
  }

  function removeWire(wire) {
    wires = wires.filter((w) => w !== wire);
    render();
  }

  // ---------- dragging ----------

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function svgPoint(evt) {
    const pt = svgEl.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }

  function startDrag(comp, evt) {
    if (running) return;
    evt.preventDefault();
    evt.stopPropagation();
    const start = svgPoint(evt);
    const origX = comp.x, origY = comp.y;
    let moved = false;

    function onMove(e) {
      const p = svgPoint(e);
      if (Math.abs(p.x - start.x) > 2 || Math.abs(p.y - start.y) > 2) moved = true;
      comp.x = clamp(origX + (p.x - start.x), 30, CANVAS_W - 30);
      comp.y = clamp(origY + (p.y - start.y), TRAY_TOP - 10, TRAY_BOTTOM);
      render();
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
    const color = selectedWireColor === "auto" ? autoColor(pending, id) : selectedWireColor;
    wires.push({ from: pending, to: id, color });
    pending = null;
    render();
  }

  function render() {
    svgEl.innerHTML = "";
    svgEl.classList.toggle("sim-editing", !running);

    // board body
    svgEl.appendChild(svgEl_("rect", {
      x: BOARD_X, y: BOARD_Y, width: BOARD_W, height: BOARD_H,
      rx: 10, fill: "#1c3d5a", stroke: "#0d2338", "stroke-width": 2,
    }));
    const label = svgEl_("text", { x: BOARD_X + 16, y: BOARD_Y + BOARD_H - 14, fill: "#7fb8e0", "font-size": 13, "font-family": "monospace" });
    label.textContent = running ? "ARDUINO UNO (running)" : "ARDUINO UNO (simulated)";
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
        fill: "none", stroke: wire.color || "#57d38c", "stroke-width": 3, "stroke-linecap": "round",
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

    // re-draw connectors on top so they stay clickable even under wires/components
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
    const onColor = led.color || "#ffe066";
    const g = svgEl_("g", { class: running ? "" : "sim-draggable" });

    const bulb = svgEl_("circle", {
      cx: led.x, cy: led.y + 18, r: 18,
      fill: isLit ? onColor : "#241f16",
      stroke: isLit ? onColor : "#5a4a2a", "stroke-width": 2,
      style: isLit ? `filter:drop-shadow(0 0 10px ${onColor})` : "",
    });
    bulb.addEventListener("mousedown", (e) => startDrag(led, e));
    bulb.addEventListener("dblclick", (e) => { e.stopPropagation(); cycleLedColor(led); });
    g.appendChild(bulb);

    const leadA = svgEl_("line", { x1: led.x - 14, y1: led.y + 18, x2: led.x - 14, y2: led.y + 56, stroke: "#888", "stroke-width": 2 });
    const leadK = svgEl_("line", { x1: led.x + 14, y1: led.y + 18, x2: led.x + 14, y2: led.y + 56, stroke: "#888", "stroke-width": 2 });
    g.appendChild(leadA);
    g.appendChild(leadK);

    const label = svgEl_("text", { x: led.x, y: led.y + 74, fill: "#9aa0b4", "font-size": 10, "text-anchor": "middle", "font-family": "monospace" });
    label.textContent = pin !== null ? `LED (pin ${pin})` : "LED (unwired)";
    g.appendChild(label);

    const removeBtn = svgEl_("text", {
      x: led.x + 24, y: led.y - 4, fill: "#ef6461", "font-size": 13, "text-anchor": "middle",
      "font-family": "monospace", style: "cursor:pointer;font-weight:bold",
    });
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", (e) => { e.stopPropagation(); removeComponent(led.id); });
    g.appendChild(removeBtn);

    svgEl.appendChild(g);
  }

  function drawButton(btn) {
    const isPressed = pressed.has(btn.id);
    const g = svgEl_("g", { class: running ? "" : "sim-draggable" });

    const body = svgEl_("rect", {
      x: btn.x - 20, y: btn.y + (isPressed ? 8 : 0), width: 40, height: 30, rx: 4,
      fill: isPressed ? "#4a4f63" : "#2a2f3f", stroke: "#9aa0b4", "stroke-width": 2,
      style: `cursor:${running ? "pointer" : "grab"}`,
    });
    body.addEventListener("mousedown", (e) => {
      if (running) { pressed.add(btn.id); render(); }
      else { startDrag(btn, e); }
    });
    body.addEventListener("mouseup", () => { if (running && pressed.has(btn.id)) { pressed.delete(btn.id); render(); } });
    body.addEventListener("mouseleave", () => { if (running && pressed.has(btn.id)) { pressed.delete(btn.id); render(); } });
    g.appendChild(body);

    const lead1 = svgEl_("line", { x1: btn.x - 14, y1: btn.y, x2: btn.x - 14, y2: btn.y + 30, stroke: "#888", "stroke-width": 2 });
    const lead2 = svgEl_("line", { x1: btn.x + 14, y1: btn.y, x2: btn.x + 14, y2: btn.y + 30, stroke: "#888", "stroke-width": 2 });
    g.appendChild(lead1);
    g.appendChild(lead2);

    const label = svgEl_("text", { x: btn.x, y: btn.y + 58, fill: "#9aa0b4", "font-size": 10, "text-anchor": "middle", "font-family": "monospace" });
    const pin = wiredPinOf(btn.id + "-1") ?? wiredPinOf(btn.id + "-2");
    label.textContent = pin !== null
      ? (running ? `Button (pin ${pin}) - hold to press` : `Button (pin ${pin})`)
      : "Button (unwired)";
    g.appendChild(label);

    const removeBtn = svgEl_("text", {
      x: btn.x + 24, y: btn.y - 6, fill: "#ef6461", "font-size": 13, "text-anchor": "middle",
      "font-family": "monospace", style: "cursor:pointer;font-weight:bold",
    });
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", (e) => { e.stopPropagation(); removeComponent(btn.id); });
    g.appendChild(removeBtn);

    svgEl.appendChild(g);
  }

  render();

  return {
    pinMode, digitalWrite, digitalRead,
    addComponent, removeComponent, clearWiring, reset, setRunning, setWireColor,
    getWirePalette: () => WIRE_PALETTE,
  };
}
