// The sketch computes and prints what a real Arduino Uno would - and anything
// the simulator can't run is rejected clearly instead of being half-run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../js/simulator/interpreter.js";
import { runInSetup, runSketch } from "./helpers/sim.js";

const compileError = (source) => {
  try {
    compile(source);
  } catch (e) {
    return e.message;
  }
  return null;
};
const printed = (body, globals = "") => {
  const r = runInSetup(body, globals);
  assert.deepEqual(r.errors, [], `unexpected error: ${r.errors}`);
  return r.lines;
};

test("whole-number division drops the remainder; float division doesn't", () => {
  assert.deepEqual(printed(`
    int a = 7; int b = 2;
    Serial.println(a / b);
    Serial.println(a % b);
    Serial.println(-7 / 2);
    Serial.println(7 / 2.0);
    float f = 7 / 2;
    Serial.println(f);`), ["3", "1", "-3", "3.50", "3.00"]);
});

test("the lesson quiz's int-division example prints 2, like the quiz says", () => {
  assert.deepEqual(printed("int a = 5;\nint b = 2;\nSerial.println(a / b);"), ["2"]);
});

test("map() does whole-number math (lesson challenge c9)", () => {
  assert.deepEqual(printed(`
    Serial.println(map(512, 0, 1023, 0, 100));
    Serial.println(map(1023, 0, 1023, 0, 255));
    Serial.println(map(600, 0, 1023, 0, 255));`), ["50", "255", "149"]);
});

test("floats print with 2 decimal places by default, or as many as asked", () => {
  assert.deepEqual(printed(`
    float t = (147 / 1023.0 * 5.0 - 0.5) * 100.0;
    Serial.println(t);
    Serial.println(3.14159, 4);
    Serial.println(2.0);
    Serial.println(-0.5);
    Serial.println(1.006);
    Serial.println(sqrt(2));`), ["21.85", "3.1416", "2.00", "-0.50", "1.01", "1.41"]);
});

test("ints are 16-bit on an Uno: they wrap around, with a warning", () => {
  const r = runInSetup("int big = 32767;\nbig = big + 1;\nSerial.println(big);\nint product = 300 * 200;\nSerial.println(product);");
  assert.deepEqual(r.lines, ["-32768", "-5536"]);
  assert.equal(r.warnings.length, 2);
  assert.match(r.warnings[0], /32767 \+ 1 = 32768, which doesn't fit in an int \(-32768 to 32767 on an Uno\)/);
  assert.match(r.warnings[1], /300 \* 200 = 60000/);
});

test("long and unsigned long do 32-bit math", () => {
  assert.deepEqual(printed(`
    long big = 300L * 200;
    Serial.println(big);
    unsigned long x = 4294967295UL;
    x = x + 1;
    Serial.println(x);
    long m = 100000;
    Serial.println(m * m);`), ["60000", "0", "1410065408"]);
});

test("storing a value that doesn't fit is explained", () => {
  const r = runInSetup("byte b = 300;\nSerial.println(b);");
  assert.deepEqual(r.lines, ["44"]);
  assert.match(r.warnings[0], /300 doesn't fit in a byte \(0 to 255 on an Uno\), so it was stored as 44/);
});

test("bool prints as 1/0 and compares equal to HIGH/LOW", () => {
  assert.deepEqual(printed(`
    bool on = true;
    Serial.println(on);
    Serial.println(5 > 3);
    if (on == HIGH) Serial.println("on == HIGH");
    on = !on;
    Serial.println(on);`), ["1", "1", "on == HIGH", "0"]);
});

test("chars are numbers that print as characters", () => {
  assert.deepEqual(printed(`
    char c = 'A';
    Serial.println(c);
    c = c + 2;
    Serial.println(c);
    Serial.println('A' + 1);
    Serial.write(72);
    Serial.println();`), ["A", "C", "66", "H"]);
});

test("Serial.print() bases: DEC, HEX, BIN, OCT", () => {
  assert.deepEqual(printed(`
    Serial.println(255, HEX);
    Serial.println(5, BIN);
    Serial.println(8, OCT);
    Serial.println(-1, HEX);
    Serial.println(42, DEC);`), ["FF", "101", "10", "FFFFFFFF", "42"]);
});

test("Strings join with +, and String() converts like Arduino's", () => {
  assert.deepEqual(printed(`
    String msg = "Temp: ";
    msg += 21;
    msg = msg + " C, ratio " + 0.5;
    Serial.println(msg);
    Serial.println(String(3.14159, 3));
    Serial.println(String(255, HEX));
    Serial.println(msg.length());`), ["Temp: 21 C, ratio 0.50", "3.142", "FF", "22"]);
});

test("adding a number to text in quotes is caught (it prints garbage on a real Uno)", () => {
  assert.match(compileError(`void setup() {\n  int x = 5;\n  Serial.println("Value: " + x);\n}\nvoid loop() {}`), /^Line 3: Adding a number to text in quotes doesn't join them in C\+\+/);
});

test("escape sequences in text work", () => {
  const r = runInSetup('Serial.print("a\\tb\\n");\nSerial.print("quote: \\" backslash: \\\\");');
  assert.equal(r.output, 'a\tb\nquote: " backslash: \\');
});

test("#define replaces whole words in code - never inside text, never above its line", () => {
  assert.deepEqual(printed(`Serial.println("LED on pin");\nSerial.println(LED);`, "#define LED 13"), ["LED on pin", "13"]);
  assert.match(compileError(`void setup() {\n  int x = SPEED;\n}\n#define SPEED 5\nvoid loop() {}`), /^Line 2: 'SPEED' was not declared/);
});

test("hex, binary, octal and suffixed number literals", () => {
  assert.deepEqual(printed("Serial.println(0xFF);\nSerial.println(0b1010);\nSerial.println(B1111);\nSerial.println(010);\nSerial.println(1000UL);\nSerial.println(2.5f);"), ["255", "10", "15", "8", "1000", "2.50"]);
});

test("ternary, bitwise operators, shifts and casts", () => {
  assert.deepEqual(printed(`
    int x = 5;
    Serial.println(x > 3 ? 10 : 20);
    Serial.println(x & 3);
    Serial.println(x | 8);
    Serial.println(x ^ 1);
    Serial.println(1 << 4);
    Serial.println(256 >> 2);
    Serial.println((float) x / 2);
    Serial.println(int(7.9));
    x %= 3;
    Serial.println(x);`), ["10", "1", "13", "4", "16", "64", "2.50", "7", "2"]);
});

test("static locals keep their value between calls", () => {
  const r = runSketch(`
    void count() { static int n = 0; n++; Serial.println(n); }
    void setup() { Serial.begin(9600); count(); count(); count(); }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.lines, ["1", "2", "3"]);
});

test("randomSeed() makes random() repeatable, and random(min, max) stays in range", () => {
  const program = `void setup() { Serial.begin(9600); randomSeed(42);
    for (int i = 0; i < 5; i++) { Serial.println(random(10, 20)); } }
    void loop() { delay(1000); }`;
  const a = runSketch(program, { ms: 10 }).lines;
  const b = runSketch(program, { ms: 10 }).lines;
  assert.deepEqual(a, b);
  assert.ok(a.every((v) => Number(v) >= 10 && Number(v) < 20));
});

test("dividing by zero stops the sketch with an explanation", () => {
  const r = runInSetup("int zero = 0;\nSerial.println(10 / zero);");
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /Division by zero/);
});

test("unsupported syntax gets a clear message, never a half-run", () => {
  const cases = [
    ["int pins[3] = {2, 3, 4};", /Arrays aren't supported in this simulator yet/],
    ["void setup() { int x = 1; switch (x) { case 1: break; } }", /switch \/ case isn't supported/],
    ["void setup() { do { } while (false); }", /do \.\.\. while loops aren't supported/],
    ["void setup() { int* p; }", /Pointers and references/],
    ["struct Point { int x; };", /Structs aren't supported/],
    ["void setup() { if (Serial.available()) {} }", /Reading from the Serial Monitor .* isn't supported/],
    ["void setup() { attachInterrupt(0, setup, RISING); }", /attachInterrupt\(\) isn't supported in this simulator yet/],
    ["#define SQUARE(x) ((x) * (x))", /macros that take arguments aren't supported/],
    ["#ifdef DEBUG\n#endif", /#ifdef isn't supported/],
  ];
  for (const [code, expected] of cases) {
    const msg = compileError(`${code}\nvoid loop() {}\n${code.includes("setup") ? "" : "void setup() {}"}`);
    assert.match(msg ?? "(compiled without error)", expected, code);
  }
});

test("syntax errors point at the right line", () => {
  assert.equal(compileError("void setup() {\n  int x = 5\n  int y = 6;\n}\nvoid loop() {}"), "Line 2: Missing ';' at the end of this line");
  assert.match(compileError("void setup() {\n  int ledPin = 13;\n  pinMode(ledPn, OUTPUT);\n}\nvoid loop() {}"), /^Line 3: 'ledPn' was not declared.*Did you mean 'ledPin'\?/);
  assert.equal(compileError("void setup() {}\n"), "Every sketch needs both a setup() and a loop() function.");
});

test("break outside a loop is a clear compile error (not '[object Object]')", () => {
  assert.equal(compileError("void setup() {\n  break;\n}\nvoid loop() {}"), "Line 2: 'break' can only be used inside a loop (for or while)");
});

test("likely mistakes compile but come with a warning", () => {
  const r = runSketch(`
    int x = 0;
    void setup() {
      Serial.begin(9600);
      if (x = 5) { Serial.println("always"); }
      if (x == 5); { Serial.println("also always"); }
      x == 6;
    }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 3);
  assert.match(r.warnings[0], /uses '=', which STORES a value/);
  assert.match(r.warnings[1], /There's a ';' right after if/);
  assert.match(r.warnings[2], /compares two values but does nothing/);
});
