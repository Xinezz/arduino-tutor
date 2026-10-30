// "Check My Solution": every official solution passes its own check, the
// classic beginner mistakes fail with feedback that names the problem, and
// the circuit part reads the real board.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lessons } from "../js/lessons/data.js";
import { CHALLENGE_CHECKS, runChallengeCheck, hasCheck } from "../js/lessons/checks.js";
import { createBoard } from "../js/simulator/board.js";
import { createFakeSvg } from "./helpers/fakeDom.js";

const challenges = lessons.filter((l) => l.challenge).map((l) => l.challenge);
const solutionOf = (id) => challenges.find((c) => c.id === id).solution;
const failures = (result) => result.items.filter((i) => !i.ok).map((i) => i.text);

test("every challenge has a check, and every check belongs to a challenge", () => {
  assert.deepEqual(challenges.filter((c) => !hasCheck(c.id)).map((c) => c.id), []);
  assert.deepEqual(Object.keys(CHALLENGE_CHECKS).filter((id) => !challenges.some((c) => c.id === id)), []);
});

for (const c of challenges) {
  test(`the official solution passes: ${c.id} "${c.title}"`, () => {
    const r = runChallengeCheck(c.id, c.solution);
    assert.equal(r.error, null, r.error?.detail);
    assert.deepEqual(failures(r), []);
    assert.equal(r.status, "pass");
  });
}

// Swap a piece of the official solution for a mistake.
const broken = (id, from, to) => {
  const src = solutionOf(id);
  assert.ok(src.includes(from), `${id} solution contains ${from}`);
  return src.replace(from, to);
};

test("c1: printing in setup() instead of loop() is spotted", () => {
  const r = runChallengeCheck("c1", 'void setup() {\n  Serial.begin(9600);\n  Serial.println("Hello Arduino");\n}\nvoid loop() {}');
  assert.equal(r.status, "fail");
  assert.match(failures(r).join("\n"), /only printed once - code in setup\(\) runs once/);
});

test("c1: a typo in the message is quoted back", () => {
  const r = runChallengeCheck("c1", broken("c1", '"Hello Arduino"', '"hello arduino"'));
  assert.match(failures(r).join("\n"), /It printed "hello arduino"/);
});

test("c2: still hardcoding 13 is spotted", () => {
  const r = runChallengeCheck("c2", "int ledPin = 13;\nvoid setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(ledPin, LOW); delay(500); }");
  assert.match(failures(r).join("\n"), /13 still appears 3 times/);
});

test("c3: forgetting pinMode() is explained, not just failed", () => {
  const r = runChallengeCheck("c3", broken("c3", "pinMode(ledPin, OUTPUT);", ""));
  assert.equal(r.status, "fail");
  assert.match(failures(r)[0], /You switch pin 13, but it's never set up as an OUTPUT, so the LED can't light - add pinMode\(13, OUTPUT\); to setup\(\)/);
});

test("c3: an LED that never turns off, and the wrong timing, are each described", () => {
  const noOff = runChallengeCheck("c3", "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(500); }");
  assert.match(failures(noOff).join("\n"), /turns on but never turns off/);
  const slow = runChallengeCheck("c3", solutionOf("c3").replaceAll("delay(500)", "delay(1000)"));
  assert.match(failures(slow).join("\n"), /stays on for about 1000 ms and off for about 1000 ms - both should be 500 ms/);
});

test("c4: INPUT instead of INPUT_PULLUP, and upside-down logic", () => {
  const input = runChallengeCheck("c4", broken("c4", "INPUT_PULLUP", "INPUT"));
  assert.match(failures(input)[0], /floats when released/);
  const inverted = runChallengeCheck("c4", broken("c4", "== LOW", "== HIGH"));
  assert.match(failures(inverted).join("\n"), /doesn't turn on while the button is held/);
});

test("c5: two lights on at once is caught", () => {
  const r = runChallengeCheck("c5", broken("c5", "digitalWrite(greenPin, LOW);\n", ""));
  assert.match(failures(r).join("\n"), /more than one LED is lit/);
});

test("c6: counting on every loop() instead of every press", () => {
  const r = runChallengeCheck("c6", broken("c6", "if (currentState == LOW && previousState == HIGH)", "if (currentState == LOW)"));
  assert.match(failures(r).join("\n"), /each press is counted over and over/);
});

test("c9: printing the raw reading instead of a percentage", () => {
  const r = runChallengeCheck("c9", broken("c9", "Serial.println(percent);", "Serial.println(raw);"));
  assert.match(failures(r).join("\n"), /prints the raw reading \(0-1023\)/);
});

test("c10: digitalWrite can't dim, and an unscaled reading overflows", () => {
  const digital = runChallengeCheck("c10", "void setup() { pinMode(9, OUTPUT); }\nvoid loop() { digitalWrite(9, analogRead(A0) > 512); }");
  assert.match(failures(digital)[0], /digitalWrite\(\) can only switch fully on or off/);
  const unscaled = runChallengeCheck("c10", broken("c10", "analogWrite(ledPin, brightness);", "analogWrite(ledPin, raw);"));
  assert.match(failures(unscaled).join("\n"), /only takes 0-255, but the reading goes up to 1023/);
});

test("c11: the lesson's own sawtooth example is not a fade in AND out", () => {
  const sawtooth = lessons.find((l) => l.id === "l4-2").body.find((b) => b.type === "code").text;
  const r = runChallengeCheck("c11", sawtooth);
  assert.equal(r.status, "fail");
  assert.match(failures(r).join("\n"), /snaps from bright straight back to dark - that's the sawtooth/);
});

test("c13: jumping back to 0° instead of sweeping back", () => {
  const r = runChallengeCheck("c13", "Servo s;\nvoid setup() { s.attach(9); }\nvoid loop() { for (int a = 0; a <= 180; a++) { s.write(a); delay(15); } }");
  assert.match(failures(r).join("\n"), /jumps from 180° straight back to 0°/);
});

test("c15: printing microseconds instead of centimetres", () => {
  const r = runChallengeCheck("c15", broken("c15", "Serial.println(distanceCm);", "Serial.println(duration);"));
  assert.match(failures(r).join("\n"), /raw echo time in microseconds/);
});

test("c18: forgetting the buzzer in the closest zone", () => {
  const r = runChallengeCheck("c18", broken("c18", "tone(buzzerPin, 1000);", ""));
  assert.deepEqual(failures(r), ["Closer than 10 cm the LED should be on AND the buzzer should sound (tone on pin 8)."]);
});

test("code that doesn't compile gets the error explanation, not a checklist", () => {
  const r = runChallengeCheck("c3", broken("c3", "pinMode(ledPin, OUTPUT);", "pinMode(ledPin, OUTPUT)"));
  assert.equal(r.status, "error");
  assert.equal(r.error.title, "Syntax error");
  assert.deepEqual(r.items, []);
});

test("the circuit part reads the real board: missing, no resistor, then right", () => {
  const board = createBoard(createFakeSvg());
  const check = () => runChallengeCheck("c3", solutionOf("c3"), board.inspectCircuit().findings);

  let r = check();
  assert.equal(r.status, "fail");
  assert.equal(r.circuitChecked, true);
  assert.match(failures(r)[0], /^Circuit: wire an LED to pin 13/);

  const led = board.addComponent("led");
  board.connect("pin-13", `${led}-a`);
  board.connect(`${led}-k`, "gnd");
  r = check();
  assert.match(failures(r)[0], /^Circuit: your LED on pin 13 has no resistor/);

  board.removeComponent(led);
  const r1 = board.addComponent("resistor");
  const led2 = board.addComponent("led");
  board.connect("pin-13", `${r1}-1`);
  board.connect(`${r1}-2`, `${led2}-a`);
  board.connect(`${led2}-k`, "gnd-railbot-2");
  r = check();
  assert.deepEqual(failures(r), []);
  assert.equal(r.status, "pass");
  assert.equal(r.items.at(-1).text, "Circuit: LED on pin 13, with its resistor");
});

test("a button wired to 5V doesn't count for an INPUT_PULLUP challenge", () => {
  const board = createBoard(createFakeSvg());
  const r1 = board.addComponent("resistor");
  const led = board.addComponent("led");
  board.connect("pin-13", `${r1}-1`);
  board.connect(`${r1}-2`, `${led}-a`);
  board.connect(`${led}-k`, "gnd");
  const btn = board.addComponent("button");
  board.connect(`${btn}-1`, "pin-7");
  board.connect(`${btn}-2`, "5v");
  const r = runChallengeCheck("c4", solutionOf("c4"), board.inspectCircuit().findings);
  assert.deepEqual(failures(r), ["Circuit: wire a button with one leg on pin 7 and the other leg on GND."]);
});
