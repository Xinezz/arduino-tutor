// Run with: npm test   (or: node --test)
//
// These drive the interpreter directly instead of going through
// startProgram(), so delay() costs no real time: each yielded delay just
// advances a fake clock. That keeps the tests fast and deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Interpreter, parse, SimError } from "../js/simulator/interpreter.js";

function makeApi(output) {
  const pins = {};
  return {
    pins,
    clock: 0,
    pinMode() {},
    digitalWrite(pin, value) { pins[pin] = value; },
    digitalRead(pin) { return pins[pin] ?? 0; },
    analogRead() { return 0; },
    millisNow() { return this.clock; },
    print(text) { output.push(text); },
  };
}

// Runs a sketch until loop() has finished `loops` times (or until `until`
// says to stop), feeding Serial Monitor input at the given simulated times.
function runSketch(source, { loops = 1, serialInput = [], maxSteps = 1_000_000 } = {}) {
  const output = [];
  const api = makeApi(output);
  const interp = new Interpreter(parse(source), api);
  const gen = interp.run();
  const pending = [...serialInput].sort((a, b) => a.at - b.at);
  for (let step = 0; step < maxSteps; step++) {
    while (pending.length && pending[0].at <= api.clock) interp.sendSerial(pending.shift().text);
    const { value, done } = gen.next();
    if (done || interp.loopCount >= loops) break;
    if (value.type === "delay") api.clock += value.ms;
  }
  return { out: output.join(""), api, interp };
}

const sketch = (name) => readFileSync(new URL(`./sketches/${name}`, import.meta.url), "utf8");

function program(setupBody, extra = "") {
  return `${extra}\nvoid setup() {\n${setupBody}\n}\nvoid loop() {}\n`;
}

function expectError(source, pattern) {
  assert.throws(() => runSketch(source), (e) => e instanceof SimError && pattern.test(e.message));
}

// ---------- functions ----------

test("sample sketch: functions", () => {
  const { out } = runSketch(sketch("functions.ino"));
  assert.equal(out, "add(2, 3) = 5\naverage = 2.50\n5! = 120\n7 is odd\n10 is even\n");
});

test("functions take parameters and return values", () => {
  const { out } = runSketch(program(`Serial.println(square(add(1, 2)));`, `
    int add(int a, int b) { return a + b; }
    int square(int x) { return x * x; }`));
  assert.equal(out, "9\n");
});

test("parameters are copies; globals are shared", () => {
  const { out } = runSketch(program(`
    int n = 5;
    bump(n);
    Serial.println(n);
    Serial.println(counter);`, `
    int counter = 0;
    void bump(int n) { n = n + 100; counter++; }`));
  assert.equal(out, "5\n1\n");
});

test("a function can't see its caller's local variables", () => {
  expectError(program(`int secret = 1; peek();`, `void peek() { Serial.println(secret); }`), /'secret' was not declared/);
});

test("recursion works", () => {
  const { out } = runSketch(program(`Serial.println(fib(15));`, `
    int fib(int n) { if (n < 2) return n; return fib(n - 1) + fib(n - 2); }`));
  assert.equal(out, "610\n");
});

test("return exits early from inside loops, including from loop() itself", () => {
  const { out } = runSketch(`
    int firstOver(int limit) {
      for (int i = 0; i < 100; i++) {
        while (true) { if (i * i > limit) return i; break; }
      }
      return -1;
    }
    void setup() { Serial.println(firstOver(50)); }
    void loop() { Serial.println("a"); return; Serial.println("never"); }`, { loops: 2 });
  assert.equal(out, "8\na\na\n");
});

test("functions can be called before they're defined, and prototypes are accepted", () => {
  const { out } = runSketch(`
    int triple(int x);
    void setup() { Serial.println(triple(4)); Serial.println(later()); }
    void loop() {}
    int triple(int x) { return x * 3; }
    int later(void) { return 7; }`);
  assert.equal(out, "12\n7\n");
});

test("char return values and parameters", () => {
  const { out } = runSketch(program(`Serial.println(grade(95)); Serial.println(next('a'));`, `
    char grade(int score) { if (score >= 90) return 'A'; return 'B'; }
    char next(char c) { return c + 1; }`));
  assert.equal(out, "A\nb\n");
});

test("wrong number of arguments is a clear error", () => {
  expectError(program(`add(1);`, `int add(int a, int b) { return a + b; }`), /add\(\) needs 2 arguments but was given 1/);
});

test("runaway recursion is caught", () => {
  expectError(program(`forever(1);`, `int forever(int n) { return forever(n + 1); }`), /Too many function calls/);
});

test("duplicate function names are rejected", () => {
  assert.throws(() => parse(`void a() {} void a() {} void setup() {} void loop() {}`), /defined twice/);
});

// ---------- arrays ----------

test("sample sketch: arrays", () => {
  const { out, api } = runSketch(sketch("arrays.ino"), { loops: 1 });
  assert.equal(out, "3 LEDs\nsum = 60\ndoubled: 20 40 60\ngrid[1][2] = 6\n");
  assert.equal(api.clock, 600); // loop() lit each of the 3 LEDs for 200ms
});

test("arrays: default zeros, partial initializers, element updates", () => {
  const { out } = runSketch(program(`
    int a[4];
    int b[4] = {7};
    a[2] = 5;
    a[2] += 3;
    a[2]++;
    b[++a[0]] = 9;
    for (int i = 0; i < 4; i++) { Serial.print(a[i]); Serial.print(","); Serial.print(b[i]); Serial.print(" "); }`));
  assert.equal(out, "1,7 0,9 9,0 0,0 ");
});

test("arrays sized by a constant and by sizeof", () => {
  const { out } = runSketch(program(`
    int data[SIZE];
    float f[] = {1.5, 2.5};
    Serial.println(sizeof(data));
    Serial.println(sizeof(data) / sizeof(data[0]));
    Serial.println(sizeof(f) / sizeof(float));
    Serial.println(sizeof(long));`, `const int SIZE = 6;`));
  assert.equal(out, "12\n6\n2\n4\n");
});

test("char arrays from a string literal", () => {
  const { out } = runSketch(program(`
    char name[] = "Bob";
    name[0] = 'R';
    Serial.println(name);
    Serial.println(name[2]);
    Serial.println(sizeof(name));`));
  assert.equal(out, "Rob\nb\n4\n");
});

test("String arrays", () => {
  const { out } = runSketch(program(`
    String words[] = {"red", "green"};
    words[1] = words[1] + "!";
    Serial.println(words[0] + " " + words[1]);
    Serial.println(words[1].length());`));
  assert.equal(out, "red green!\n6\n");
});

test("out-of-bounds access is a clear error", () => {
  expectError(program(`int a[3]; a[3] = 1;`), /Index 3 is outside the array 'a' \(valid indexes are 0 to 2\)/);
  expectError(program(`int a[3] = {1, 2, 3}; Serial.println(a[-1]);`), /Index -1 is outside/);
});

test("array declaration mistakes are clear errors", () => {
  expectError(program(`int a[2] = {1, 2, 3};`), /Too many starting values/);
  expectError(program(`int a[];`), /needs a size/);
  expectError(program(`int x = 5; x[0] = 1;`), /'x' is not an array/);
  expectError(program(`int a[2]; int b[2]; a = b;`), /can't assign to a whole array/);
});

// ---------- Serial input ----------

test("sample sketch: Serial input", () => {
  const { out, interp } = runSketch(sketch("serial-input.ino"), {
    loops: 6,
    serialInput: [
      { at: 0, text: "250\n" },
      { at: 600, text: "  OFF \n" },
      { at: 700, text: "dance\n" },
      { at: 800, text: "on\n" },
    ],
  });
  assert.equal(out,
    "Type on, off, or a blink speed in ms:\n" +
    "Blink speed: 250\n" +
    "Blinking off\n" +
    "Unknown command: dance\n" +
    "Blinking on\n");
  assert.equal(interp.globals.blinkMs, 250);
});

test("Serial.available, read and peek", () => {
  const { out } = runSketch(`
    void setup() {}
    void loop() {
      if (Serial.available() > 0) {
        Serial.println(Serial.available());
        Serial.println(Serial.peek());
        char c = Serial.read();
        Serial.println(c);
        Serial.println(Serial.read() - '0');
        Serial.println(Serial.read() == 'z');
        Serial.println(Serial.read());
      }
    }`, { loops: 2, serialInput: [{ at: 0, text: "A7z" }] });
  assert.equal(out, "3\n65\nA\n7\ntrue\n-1\n");
});

test("Serial.parseInt waits for input and skips non-digits; parseFloat reads decimals", () => {
  const { out, api } = runSketch(program(`
    int a = Serial.parseInt();
    int b = Serial.parseInt();
    float f = Serial.parseFloat();
    Serial.println(a + b);
    Serial.println(f);`), { serialInput: [{ at: 300, text: "x12, -5 and 2.75\n" }] });
  assert.equal(out, "7\n2.75\n");
  assert.equal(api.clock, 300); // it waited (in simulated time) for the input to arrive
});

test("Serial.parseInt times out to 0 when nothing is typed", () => {
  const { out, api } = runSketch(program(`Serial.println(Serial.parseInt());`));
  assert.equal(out, "0\n");
  assert.equal(api.clock, 1000);
});

test("Serial.readString / readStringUntil and String methods", () => {
  const { out } = runSketch(program(`
    String first = Serial.readStringUntil('\\n');
    String rest = Serial.readString();
    Serial.println(first.toInt() * 2);
    rest.trim();
    rest.toUpperCase();
    Serial.println(rest);
    Serial.println(rest.indexOf("B"));
    Serial.println(rest.substring(1, 3));
    Serial.println(rest.equalsIgnoreCase("abc"));`), { serialInput: [{ at: 0, text: "21\n  abc \n" }] });
  assert.equal(out, "42\nABC\n1\nBC\ntrue\n");
});

// ---------- things fixed along the way ----------

test("escape sequences in strings and chars", () => {
  const { out } = runSketch(program(`Serial.print("a\\tb\\n"); Serial.print('\\n');`));
  assert.equal(out, "a\tb\n\n");
});

test("existing features still work: objects, #define, multiple declarators", () => {
  const { out } = runSketch(program(`
    myServo.attach(9);
    myServo.write(200);
    Serial.println(myServo.read());
    Serial.println(LED + x + y);`, `
    #define LED 13
    #include <Servo.h>
    Servo myServo;
    int x = 1, y = 2;`));
  assert.equal(out, "180\n16\n");
});
