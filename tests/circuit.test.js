// The virtual board's electrical model and its circuit check: every finding
// must come from the real connections on the board, and the board must never
// quietly work in a way a real one wouldn't without saying so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBoard } from "../js/simulator/board.js";
import { createFakeSvg } from "./helpers/fakeDom.js";

function boardWith(opts = {}) {
  const board = createBoard(createFakeSvg(), { random: () => 0.25, ...opts });
  return board;
}

// pin -> resistor -> LED + ; LED − -> GND (the standard, correct circuit)
function standardLed(board, pin = 13) {
  const r = board.addComponent("resistor");
  const led = board.addComponent("led");
  board.connect(`pin-${pin}`, `${r}-1`);
  board.connect(`${r}-2`, `${led}-a`);
  board.connect(`${led}-k`, "gnd");
  return { r, led };
}

const levels = (report, level) => report.findings.filter((f) => f.level === level);
const texts = (report, level) => levels(report, level).map((f) => `${f.subject}: ${f.text}`);

test("a correctly wired LED lights while its OUTPUT pin is HIGH", () => {
  const board = boardWith();
  const { led } = standardLed(board);
  board.setRunning(true);
  board.pinMode(13, "OUTPUT");
  board.digitalWrite(13, 1);
  assert.equal(board.ledLevels()[led], 255);
  board.digitalWrite(13, 0);
  assert.equal(board.ledLevels()[led], 0);
});

test("an LED in backwards stays dark, and the check says it's backwards", () => {
  const board = boardWith();
  const r = board.addComponent("resistor");
  const led = board.addComponent("led");
  board.connect("pin-13", `${r}-1`);
  board.connect(`${r}-2`, `${led}-k`); // short leg toward the pin
  board.connect(`${led}-a`, "gnd"); // long leg to GND
  board.setRunning(true);
  board.pinMode(13, "OUTPUT");
  board.digitalWrite(13, 1);
  assert.equal(board.ledLevels()[led], 0);
  const report = board.inspectCircuit();
  assert.equal(report.problems, 1);
  assert.match(texts(report, "problem")[0], /^LED 1: It's in backwards/);
});

test("an LED with no GND connection stays dark, and the check says the circuit is incomplete", () => {
  const board = boardWith();
  const r = board.addComponent("resistor");
  const led = board.addComponent("led");
  board.connect("pin-13", `${r}-1`);
  board.connect(`${r}-2`, `${led}-a`);
  board.setRunning(true);
  board.pinMode(13, "OUTPUT");
  board.digitalWrite(13, 1);
  assert.equal(board.ledLevels()[led], 0);
  assert.match(texts(board.inspectCircuit(), "problem")[0], /short leg \(−\) isn't connected to anything/);
});

test("an LED wired to 5V is on only while the board is powered; one sinking into a LOW pin works too", () => {
  const board = boardWith();
  const r = board.addComponent("resistor");
  const led = board.addComponent("led");
  board.connect("5v", `${r}-1`);
  board.connect(`${r}-2`, `${led}-a`);
  board.connect(`${led}-k`, "pin-7");
  assert.equal(board.ledLevels()[led], 0, "not running = not powered");
  board.setRunning(true);
  assert.equal(board.ledLevels()[led], 0, "pin 7 isn't an output yet, so there's no path to ground");
  board.pinMode(7, "OUTPUT");
  board.digitalWrite(7, 0);
  assert.equal(board.ledLevels()[led], 255, "current flows from 5V into the LOW pin");
  board.digitalWrite(7, 1);
  assert.equal(board.ledLevels()[led], 0, "both sides HIGH: no current");
});

test("Stop powers the board down: nothing stays lit, and the last run is remembered for the check", () => {
  const board = boardWith();
  const { led } = standardLed(board);
  board.setRunning(true);
  board.pinMode(13, "OUTPUT");
  board.digitalWrite(13, 1);
  board.pinMode(9, "OUTPUT");
  board.setRunning(false);
  assert.equal(board.ledLevels()[led], 0);
  assert.deepEqual(board.pinStatus(13), { mode: "INPUT", floating: true, pullup: false, level: 0 });
  assert.ok(texts(board.inspectCircuit(), "info").some((t) => /last run used pin 9 as an OUTPUT, but nothing is wired to pin 9/.test(t)));
});

test("the check: a standard LED circuit is OK, with no problems", () => {
  const board = boardWith();
  standardLed(board);
  const report = board.inspectCircuit();
  assert.equal(report.problems, 0);
  assert.equal(report.real, 0);
  const ok = levels(report, "ok");
  assert.equal(ok.length, 1);
  assert.equal(ok[0].text, "Complete circuit: pin 13 → resistor → LED → GND.");
  assert.deepEqual(ok[0].data, { pin: 13, resistor: true });
});

test("the check: an LED with no resistor works here but gets a real-board note", () => {
  const board = boardWith();
  const led = board.addComponent("led");
  board.connect("pin-13", `${led}-a`);
  board.connect(`${led}-k`, "gnd");
  const report = board.inspectCircuit();
  assert.equal(report.problems, 0);
  assert.match(texts(report, "real")[0], /No resistor in series\. The simulator still lights it, but a real LED/);
  assert.deepEqual(levels(report, "ok")[0].data, { pin: 13, resistor: false });
});

test("the check: a resistor on the GND side counts as in series too", () => {
  const board = boardWith();
  const led = board.addComponent("led");
  const r = board.addComponent("resistor");
  board.connect("pin-13", `${led}-a`);
  board.connect(`${led}-k`, `${r}-1`);
  board.connect(`${r}-2`, "gnd");
  const report = board.inspectCircuit();
  assert.equal(report.problems + report.real, 0);
  assert.equal(levels(report, "ok")[0].data.resistor, true);
});

test("the check: a 10kΩ resistor in front of an LED is called out (brightness isn't simulated)", () => {
  const board = boardWith();
  const { r } = standardLed(board);
  board.updateComponent(r, { ohms: 10000 });
  assert.match(texts(board.inspectCircuit(), "real")[0], /10kΩ resistor\. A real LED would be very dim/);
});

test("the check: short circuits", () => {
  const board = boardWith();
  board.connect("5v", "gnd-railtop-3");
  assert.match(texts(board.inspectCircuit(), "problem")[0], /5V is wired straight to GND - a short circuit/);

  const b2 = boardWith();
  b2.connect("pin-8", "gnd");
  assert.equal(b2.inspectCircuit().problems, 0, "a pin wired to GND is fine for an input");
  b2.setRunning(true);
  b2.pinMode(8, "OUTPUT");
  b2.setRunning(false);
  assert.match(texts(b2.inspectCircuit(), "problem")[0], /Pin 8 is an OUTPUT in your sketch but is wired straight to GND/);
});

test("the check: buttons - complete, half-wired, and floating", () => {
  const board = boardWith();
  const b = board.addComponent("button");
  board.connect(`${b}-1`, "pin-7");
  assert.match(texts(board.inspectCircuit(), "problem")[0], /other leg doesn't reach GND or 5V/);
  board.connect(`${b}-2`, "gnd");
  let report = board.inspectCircuit();
  assert.equal(report.problems, 0);
  assert.match(levels(report, "ok")[0].text, /INPUT_PULLUP/);

  // A run that forgot the pull-up: the released button leaves the pin floating.
  board.setRunning(true);
  board.pinMode(7, "INPUT");
  board.setRunning(false);
  report = board.inspectCircuit();
  assert.match(texts(report, "problem")[0], /pinMode\(7, INPUT\) with no pull-up/);

  const b2 = boardWith();
  const btn = b2.addComponent("button");
  b2.connect(`${btn}-1`, "pin-2");
  b2.connect(`${btn}-2`, "5v");
  assert.match(texts(b2.inspectCircuit(), "info")[0], /Nothing pulls pin 2 LOW while the button is released/);
  const pd = b2.addComponent("resistor");
  b2.connect("pin-2", `${pd}-1`);
  b2.connect(`${pd}-2`, "gnd");
  assert.equal(texts(b2.inspectCircuit(), "info").filter((t) => /floats/.test(t)).length, 0, "a pull-down fixes it");
});

test("a buzzer only sounds when its − leg reaches GND", () => {
  const board = boardWith();
  const bz = board.addComponent("buzzer");
  board.connect(`${bz}-s`, "pin-8");
  assert.match(texts(board.inspectCircuit(), "problem")[0], /doesn't reach GND, so no current flows and it stays silent/);
  board.connect(`${bz}-g`, "gnd");
  assert.equal(board.inspectCircuit().problems, 0);
});

test("simplifications are said out loud: sensors, servo, LCD, and the breadboard rails", () => {
  const board = boardWith();
  const pot = board.addComponent("potentiometer");
  board.connect(`${pot}-w`, "pin-14");
  const servo = board.addComponent("servo");
  board.connect(`${servo}-s`, "pin-9");
  board.addComponent("lcd");
  const led = board.addComponent("led");
  const r = board.addComponent("resistor");
  board.connect("pin-12", `${r}-1`);
  board.connect(`${r}-2`, `${led}-a`);
  board.connect(`${led}-k`, "gnd-railbot-4");
  const real = texts(board.inspectCircuit(), "real").join("\n");
  assert.match(real, /Potentiometer 1: Its outer legs aren't connected to 5V and GND/);
  assert.match(real, /Servo 1: A real servo has three wires/);
  assert.match(real, /LCD 1: The simulated LCD needs no wires/);
  assert.match(real, /breadboard's − rail\. The simulator treats it as GND automatically/);
  board.connect("gnd", "gnd-railtop-0");
  assert.doesNotMatch(texts(board.inspectCircuit(), "real").join("\n"), /− rail/, "jumpering the rail removes the note");
});

test("an analog sensor on a digital pin is a problem", () => {
  const board = boardWith();
  const ldr = board.addComponent("ldr");
  board.connect(`${ldr}-s`, "pin-5");
  assert.match(texts(board.inspectCircuit(), "problem")[0], /analogRead\(\) only works on the analog pins A0-A5/);
});

test("problems are listed before notes, and an empty board says how to start", () => {
  const empty = boardWith().inspectCircuit();
  assert.match(empty.findings[0].text, /The board is empty/);
  const board = boardWith();
  standardLed(board);
  board.addComponent("led"); // a second, unwired LED
  const bz = board.addComponent("buzzer");
  board.connect(`${bz}-s`, "pin-8");
  const order = board.inspectCircuit().findings.map((f) => f.level);
  assert.deepEqual(order, [...order].sort((a, b) => ["problem", "real", "info", "ok"].indexOf(a) - ["problem", "real", "info", "ok"].indexOf(b)));
  assert.equal(order[0], "problem");
});

test("onCircuitChange fires for wiring changes, not for pin changes during a run", () => {
  let changes = 0;
  const board = boardWith({ onCircuitChange: () => changes++ });
  const led = board.addComponent("led");
  board.connect("pin-13", `${led}-a`);
  board.removeComponent(led);
  assert.equal(changes, 3);
  board.setRunning(true);
  board.pinMode(13, "OUTPUT");
  board.digitalWrite(13, 1);
  assert.equal(changes, 3);
});
