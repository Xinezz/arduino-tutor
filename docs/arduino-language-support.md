# Arduino language support in the ArduinoTutor simulator

The simulator runs a **subset of Arduino C++** in the browser
(`js/simulator/interpreter.js`) against a virtual Arduino Uno
(`js/simulator/board.js`). This page is the source of truth for what that
subset is. Anything not listed as supported is **rejected with a clear message**
before the sketch starts - the simulator never half-runs code it doesn't
understand.

Every rule here is covered by the automated tests in `tests/` (run them with
`npm test`, Node 22+).

## How a sketch runs

1. **Tokenize**, including `#define` / `#include` handling.
2. **Parse** into a syntax tree. Syntax errors stop here.
3. **Check** the whole program before anything runs: names, types, `const`,
   function calls and argument counts, `return`, `break` / `continue`. Errors
   stop here; *warnings* (likely mistakes) are shown but the sketch still runs.
4. **Run** `setup()` once, then `loop()` forever, until Stop is pressed or an
   error happens at run time (for example dividing by zero).

Messages always start with `Line N:` so the learner can find the problem.

## Supported language

| Area | Supported |
| --- | --- |
| Program structure | `setup()` and `loop()` (both required), global variables, your own functions declared above or below where they're used (Arduino generates the prototypes, so does the simulator), function prototypes |
| Types | `int`, `unsigned int`, `long`, `unsigned long`, `short`, `byte`, `word`, `char`, `unsigned char`, `bool` / `boolean`, `float`, `double`, `String`, `void`; `uint8_t`, `int8_t`, `uint16_t`, `int16_t`, `uint32_t`, `int32_t`, `size_t` |
| Qualifiers | `const` (enforced), `static` locals (keep their value between calls), `volatile` (accepted; it has no effect because interrupts aren't simulated) |
| Variables | Declarations with or without initial values, several per line (`int a = 1, b = 2;`), block scope (a variable declared inside `{ }` disappears at the `}`), shadowing |
| Functions | Parameters, arguments (converted to the parameter type like real C++), return values, `return;` from `void` functions, early `return` from inside nested blocks and loops, recursion (up to 64 calls deep) |
| Statements | `if` / `else if` / `else`, `for`, `while`, `break`, `continue`, `return`, blocks, empty statements |
| Operators | `+ - * / %`, `== != < > <= >=`, `&& \|\| !`, `& \| ^ ~ << >>`, `= += -= *= /= %= &= \|= ^= <<= >>=`, `++` / `--` (prefix and postfix), `? :`, casts (`(float) x`, `float(x)`, `int(x)`) |
| Literals | Decimal, hex (`0xFF`), binary (`0b1010`, `B1010`), octal (`010`), suffixes `U`, `L`, `UL`, `f`; character literals with escapes (`'\n'`, `'\t'`, `'\\'`, `'\''`, `'\0'`); string escapes; adjacent strings join (`"a" "b"`) |
| Preprocessor | `#include <...>` (accepted and ignored - the supported libraries are always available); `#define NAME value` replaces whole words *below* its line and never inside strings; `#undef` |
| Constants | `HIGH`, `LOW`, `INPUT`, `OUTPUT`, `INPUT_PULLUP`, `LED_BUILTIN` (13), `A0`-`A5` (14-19, as on a real Uno), `DEC`, `HEX`, `OCT`, `BIN`, `PI`, `true`, `false` |

### Numbers behave like they do on an Uno

The simulator follows the Uno's 8-bit AVR rules rather than JavaScript's:

- `int` is **16-bit** (-32768 to 32767) and `long` is 32-bit. Results that
  don't fit **wrap around**, as on the real board, and the simulator shows a
  warning explaining it. For example, `300 * 200` gives -5536 in an `int`.
- Arithmetic follows C's rules: `char` / `byte` / `bool` are promoted to `int`,
  mixed types use the "bigger" type, and integer division **drops the
  remainder** (`7 / 2` is 3, `-7 / 2` is -3).
- Storing a value that doesn't fit warns and stores what the Uno would store
  (`byte b = 300;` stores 44).
- `float` and `double` are both 32-bit floats, as on an Uno. They print with 2
  decimal places by default, using the same rounding as Arduino's
  `Print::printFloat` (`nan`, `inf` and `ovf` included).
- `bool` prints as `1` / `0`. `char` is a number that prints as a character.
- `map()` uses whole-number `long` math, like Arduino's (`map(512, 0, 1023, 0, 100)` is 50).
- Dividing by zero (`/` or `%`) **stops the sketch with an error**. A real Uno
  would carry on with a garbage value, but stopping is clearer for a learner.
  This is one of the few deliberate differences.

### Text

- `String` objects: `+` and `+=` with text and numbers, `String(value)`,
  `String(value, HEX)`, `String(3.14159, 3)`, `.length()`, comparison with
  `==` / `!=`.
- `"Value: " + x` (adding a number to *quoted text*) is a **compile error**,
  because in real C++ it does pointer arithmetic and prints garbage. The message
  suggests `String("Value: ") + x` or two `Serial.print` calls.
- `F("text")` is accepted (it just passes the text through).

### Built-in functions

| Group | Functions |
| --- | --- |
| Digital I/O | `pinMode`, `digitalWrite`, `digitalRead` |
| Analog I/O | `analogRead` (A0-A5, or 0-5 for A0-A5), `analogWrite` |
| Time | `delay`, `delayMicroseconds`, `millis`, `micros` |
| Sound and pulses | `tone(pin, freq[, duration])`, `noTone`, `pulseIn` |
| Math | `abs`, `min`, `max`, `constrain`, `sq`, `map`, `sqrt`, `pow`, `sin`, `cos`, `tan`, `floor`, `ceil`, `round` |
| Random | `random(max)`, `random(min, max)`, `randomSeed(seed)` (repeatable) |
| Serial (output only) | `Serial.begin`, `Serial.print`, `Serial.println` (with `DEC` / `HEX` / `OCT` / `BIN` or a decimal-places count), `Serial.write`, `Serial.flush` |
| Servo library | `Servo` objects: `attach`, `write`, `writeMicroseconds`, `read`, `attached`, `detach` |
| LiquidCrystal library | `LiquidCrystal lcd(...)`: `begin`, `print`, `write`, `setCursor`, `clear`, `home` |

Calls are checked before the sketch runs: wrong argument counts produce a
message showing the correct usage, for example `digitalWrite(pin, value)`.

## Not supported (rejected with a message)

| Feature | Message points the learner to |
| --- | --- |
| Arrays (`int pins[3]`) | use separate variables for now; see the plan below |
| `switch` / `case` | `if` / `else if` |
| `do ... while` | `while` |
| Pointers and references (`int*`, `&x`, `->`) | plain variables / `String` |
| `struct`, `class`, `enum`, `union`, `typedef`, `namespace`, templates, `goto`, `sizeof`, `new` / `delete`, `auto`, `extern`, `inline`, operator overloading | an alternative where one exists |
| Function-like macros (`#define SQUARE(x) ...`), `#ifdef` / `#if` / other directives | write a function instead |
| Default parameter values | pass every argument |
| Reading from the Serial Monitor (`Serial.available`, `Serial.read`, `Serial.parseInt`, ...) | output only for now |
| `attachInterrupt`, `shiftOut` / `shiftIn`, `bitRead` / `bitWrite` / `bitSet` / `bitClear` / `bit`, `lowByte` / `highByte`, `analogReference`, `fmod`, `log`, `exp`, ... | "isn't supported in this simulator yet" (not "was not declared") |
| Libraries other than Servo and LiquidCrystal | "Unknown type ..." |

Undeclared names get a spelling suggestion when one is close:
`'ledPn' was not declared ... Did you mean 'ledPin'?`.

## Errors and warnings

Every error is labelled with its **kind**, so a learner can tell a typo from a
simulator limit: *Syntax error* (the code breaks C++ grammar - a missing `;`
or `}`), *Code problem* (grammatical, but something doesn't make sense - an
undeclared name, a type mismatch, a changed `const`), *Not supported in this
simulator* (possibly valid Arduino code the simulator can't run) or *Runtime
error* (it broke while running). The line is highlighted in the editor, and
`js/simulator/feedback.js` adds hints (revealed one at a time, gentlest first), the lesson to review, and how to carry on. Warnings and circuit-check findings get the same hints-and-lesson treatment. Wiring problems
are never reported as code errors - they come from the circuit check below.

**Errors** stop the sketch (or prevent it starting). They cover syntax mistakes,
undeclared names, wrong argument counts, type mismatches, assigning to a
`const` (the message gives the line the constant was declared on),
`break` / `continue` outside a loop, `return` with or without a value in the
wrong kind of function, a missing `setup()` / `loop()`, and division by zero.

**Warnings** appear in amber in the Serial Monitor area. Each problem is
reported once, not every time `loop()` repeats, and warnings never stop the
sketch. They explain code that runs but probably doesn't
do what was meant:

| Warning | Why it matters on real hardware |
| --- | --- |
| `digitalWrite()` on a pin not set to `OUTPUT` | It only switches the weak internal pull-up on or off - an LED would barely glow |
| `analogWrite()` on a pin without PWM (not 3, 5, 6, 9, 10 or 11) | The pin can't dim: it's fully on for values of 128 or more and fully off below that |
| `analogWrite()` value outside 0-255 | Only the lowest 8 bits are kept (300 becomes 44) |
| `digitalRead()` of a floating input | Nothing pulls the pin HIGH or LOW, so it reads random noise |
| `analogRead()` of a pin other than A0-A5 | Only A0-A5 can read analog values |
| Pin numbers that don't exist on an Uno | The call is ignored |
| Using pins 0 / 1 while Serial is running | They are the Serial RX / TX lines |
| Printing before `Serial.begin()` | Nothing would appear in the Serial Monitor (the simulator still shows it) |
| Negative `delay()` | It becomes a huge unsigned wait (about 49 days) |
| Whole-number overflow, or a value that doesn't fit its variable | The value wraps around |
| `if (x = 5)`, `if (...);`, `x == 6;` on its own, a non-`void` function that can end without `return` | Classic beginner mistakes that compile on a real Arduino |

## Timing

- `delay(ms)` waits the **full** duration in real time. Nothing is shortened.
- `millis()` / `micros()` report simulated time since Run was pressed, and
  always agree with `delay()`: after `delay(5000)`, `millis()` has advanced by
  at least 5000. If a browser timer fires early, the simulator waits out the
  rest.
- **Stop** cancels a pending `delay()` immediately. A stopped run can never
  resume or touch the board again, even if an old timer fires, and starting a
  new run never interferes with the old one.
- A `loop()` with no `delay()` regularly hands control back to the browser, so
  the page stays responsive and Stop always works.
- A sketch is automatically stopped after 5 minutes of running (a safety net
  for runaway programs). Click Run to start again.
- `delayMicroseconds()` and `pulseIn()` don't take any simulated time. They
  are too short to matter at this resolution.
- **Fast mode** exists only as an explicit option, `startProgram(..., { timeScale })`.
  For example, `timeScale: 2` runs simulated time at double speed, and
  `millis()` speeds up to match. The UI doesn't expose it; normal runs always
  use real time.

## The virtual Uno: simplifications

The board models what beginner circuits need. The rules a learner relies on
match real hardware:

- **Pin modes:** `pinMode(pin, OUTPUT)` drives the pin. `digitalWrite()` on an
  `INPUT` pin switches the internal pull-up instead of driving it, as on the
  real chip. `analogWrite()` makes the pin an output, as the Arduino core does.
- **Reading inputs** follows this order of precedence: something that drives
  the pin directly (a wire or pressed button to GND / 5V, an IR sensor)
  beats a pull-up or pull-down (internal `INPUT_PULLUP`, or a resistor to
  5V / GND), which beats nothing. With nothing at all the pin is **floating**
  and reads random values, with a warning.
- **PWM:** pins 3, 5, 6, 9, 10 and 11 dim smoothly. Other pins switch at 128.

Deliberate simplifications:

- **LEDs** follow the direction of current: one lights when its long leg (+,
  anode) reaches something HIGH - an `OUTPUT` pin that is HIGH (directly or
  through a resistor), or 5V while the board is running - and its short leg
  (−, cathode) reaches something LOW (GND, or an `OUTPUT` pin that is LOW).
  Backwards, half-wired or with both legs on the same connection, it stays
  dark. An LED on a pin that only has its pull-up on is drawn as off (on real
  hardware it glows very faintly).
- **Stop** is like unplugging the board: every pin powers down, so nothing
  stays lit or keeps sounding.
- A **buzzer** only sounds when its − leg reaches GND, and `tone()` on a pin
  with no buzzer makes no sound - exactly as on a real board.

Deliberate simplifications - each one is pointed out by the **circuit check**
(Check Circuit) as a "REAL BOARD" note on the learner's own circuit, and listed
in the in-app **Simulator Limits** window, so none of them is silent:

- No current or voltage is calculated. An LED with no series resistor still
  lights (a real one would burn out), and a 10kΩ resistor doesn't make it
  dimmer. The circuit check detects both from the wiring.
- There is one GND net and one 5V net. Breadboard rails are live without
  jumpering them to the Arduino first (top and bottom rails are joined too).
- Parts don't plug into the breadboard by sitting on it: every leg is
  connected with a wire. Holes in the same 5-hole column are connected, like a
  real breadboard.
- Potentiometers, light sensors, the temperature sensor, IR sensor, servo and
  ultrasonic module work without their power / GND legs; the LCD needs no
  wires at all.
- A pressed button is only read by input pins; current doesn't flow through it
  to light an LED directly.
- LEDs in series (one LED's − leg to the next one's + leg) aren't simulated:
  Check Circuit reports them as not connected. Each LED needs its own path from
  a pin or 5V to GND. A real series pair would light dimly, sharing the 5V -
  the "Series vs parallel" demo in Module 1 shows that behaviour.
- Sensors produce clean values from their on-screen sliders (no noise), except
  for floating digital pins.
- Unwired header pins (IOREF, RESET, 3V3, VIN) are drawn but not connected to
  anything.
- Timers, interrupts, EEPROM, I2C, SPI and sleep modes are not simulated.

## The circuit check

`board.inspectCircuit()` reads the board's real connections (wires, breadboard
columns, rails, resistors) and returns findings at four levels: **problem**
(can't work as wired), **real** (works here, but not on a real board),
**info** and **ok**. It only reports what's on the board - never a guess about
what the learner meant. It covers:

- LEDs: not wired, backwards, a leg not reaching GND or a pin, both legs
  joined, no series resistor, a 10kΩ resistor, wired to 5V (always on), and a
  pin the last run never set to `OUTPUT`.
- Short circuits: 5V wired straight to GND; an `OUTPUT` pin wired straight to
  GND or 5V.
- Buttons: half-wired, both legs joined, floating when released (to 5V with no
  pull-down, or to GND with `INPUT` and no pull-up), and `INPUT_PULLUP` with a
  button to 5V.
- RGB LEDs, buzzers, potentiometers, light/temperature/IR/ultrasonic sensors,
  servos and the LCD: missing connections, analog sensors on digital pins, and
  the power legs a real part would need.
- Breadboard rails used without a jumper from the Arduino's GND / 5V pin.
- Pins the last run used as outputs with nothing wired to them.

When Run is pressed, any wiring **problems** are also printed in the Serial
Monitor (labelled "WIRING PROBLEM", in their own color) before the sketch
starts.

## Plan: array support

Arrays are the most-requested missing feature (they come up with
multiple-LED projects). They are currently rejected with an explicit "not
supported yet" message. The plan, in order:

1. **Declarations:** `int pins[4];` (zero-filled globals, as in C) and
   `int pins[] = {2, 3, 4, 5};` / `int pins[4] = {2, 3};` (size from or padded
   by the initializer). The size must be a constant expression (a literal,
   `const`, or `#define`). `const` arrays are read-only. Element types are the
   numeric types, `char` and `String`; `char text[] = "hi"` gets a `'\0'`
   terminator.
2. **Indexing:** `pins[i]` as a value and as an assignment target, including
   `+=`, `++` and the other compound assignments. Element values use the same
   wrap / convert / warn rules as plain variables.
3. **Bounds checks:** an out-of-range index is a **run-time error** that names
   the array, the index and the valid range, for example
   `Line 12: pins[4] is outside the array - pins has 4 elements, so the index must be 0 to 3`.
   A real Uno would silently read or overwrite other memory, so this is a
   deliberate, documented difference (like division by zero). Constant
   indexes are checked before the sketch runs.
4. **sizeof:** `sizeof(pins)` (in bytes, using Uno sizes: int 2, long 4,
   float 4) and the idiom `sizeof(pins) / sizeof(pins[0])`.
5. **Passing to functions:** `void blinkAll(int pins[], int count)`, passed
   by reference as in C++ (the function can change the caller's elements).
   Returning arrays, and arrays of arrays, stay unsupported with a message.
6. **Tests:** declaration forms and initializers, zero-fill, element wrapping,
   compound assignment on elements, `const` arrays, every bounds-check path
   (constant and computed indexes, negative indexes), `sizeof`, passing to and
   modifying in a function, and a "chase lights" lesson-style sketch on the
   board.

Until then, `switch`, `do ... while` and Serial input remain the next
candidates after arrays.
