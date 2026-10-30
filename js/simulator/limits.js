// The "Simulator Limits" window: what the simulator runs, what it doesn't,
// and every place it simplifies real hardware - so nothing it does
// differently from a real Uno happens silently. The full reference is
// docs/arduino-language-support.md; keep the two in step.

import { openModal } from "../game/modal.js";

const DOCS_URL = "https://github.com/Xinezz/arduino-tutor/blob/main/docs/arduino-language-support.md";

const SECTIONS = [
  {
    heading: "Code it runs",
    items: [
      "setup() and loop(), your own functions (with parameters and return values), variables, const, #define.",
      "if / else, for, while, break, continue, return, and all the usual operators.",
      "Types: int, long, unsigned, byte, bool, char, float, String. Numbers behave like a real Uno: int is 16-bit (it wraps past 32767), and 7 / 2 is 3.",
      "pinMode, digitalWrite/Read, analogWrite/Read, delay, millis, tone, map, constrain, random, Serial.print/println, and the Servo and LiquidCrystal libraries.",
    ],
  },
  {
    heading: "Code it doesn't run (yet)",
    items: [
      "Arrays, switch / case, do ... while, pointers, structs and classes.",
      "Reading from the Serial Monitor (Serial.read, Serial.available...), interrupts, and libraries other than Servo and LiquidCrystal.",
      "You'll get a clear \"not supported in this simulator\" message - never a half-run sketch. Your code may still be fine on a real Arduino.",
    ],
  },
  {
    heading: "How the board behaves",
    items: [
      "Pins really need pinMode(): an LED only lights from an OUTPUT pin, and digitalWrite() on an input pin just switches its pull-up.",
      "Current only flows round a complete loop: an LED lights with its + leg toward a HIGH pin (or 5V) and its − leg to GND. Backwards or half-wired, it stays dark.",
      "Input pins with nothing connected \"float\" and read random values - use INPUT_PULLUP or a pull-down resistor.",
      "Only pins 3, 5, 6, 9, 10 and 11 can dim with analogWrite(); other pins switch fully on at 128 or more.",
      "Stop is like unplugging the board: every pin powers down.",
    ],
  },
  {
    heading: "Where it simplifies real hardware",
    note: "Check Circuit points these out on your own circuit.",
    items: [
      "No current or voltage is calculated: an LED with no resistor still lights here (a real one would burn out), and a 10kΩ resistor doesn't make it dimmer.",
      "Parts don't plug into the breadboard by sitting on it - connect every leg with a wire. Holes in the same 5-hole column are connected, like a real breadboard.",
      "The breadboard's + and − rails are live as 5V and GND automatically. On a real one, run wires from the Arduino's 5V and GND pins to the rails first.",
      "Sensors, the servo and the ultrasonic module work without their power wires, and the LCD needs no wires at all. Real ones need 5V and GND too.",
      "A pressed button is only read by an input pin - current doesn't flow through it to light an LED directly.",
      "delay() and millis() use real time. delayMicroseconds() and pulseIn() take no time at all.",
    ],
  },
];

export function openSimulatorLimits() {
  const body = document.createElement("div");
  body.className = "limits-body";
  for (const section of SECTIONS) {
    const h = document.createElement("div");
    h.className = "set-heading";
    h.textContent = section.heading;
    body.appendChild(h);
    if (section.note) {
      const n = document.createElement("p");
      n.className = "set-note";
      n.textContent = section.note;
      body.appendChild(n);
    }
    const ul = document.createElement("ul");
    ul.className = "limits-list";
    for (const item of section.items) {
      const li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    }
    body.appendChild(ul);
  }
  const more = document.createElement("p");
  more.className = "set-note";
  more.append("The full list, with every detail: ");
  const a = document.createElement("a");
  a.href = DOCS_URL;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Arduino language support (opens GitHub)";
  more.appendChild(a);
  body.appendChild(more);

  return openModal({
    title: "SIMULATOR LIMITS",
    content: body,
    className: "modal-wide",
    actions: [{ label: "Got It", kind: "primary" }],
  });
}
