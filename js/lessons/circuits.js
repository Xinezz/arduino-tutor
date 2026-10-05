// Starting circuits a lesson's challenge can open with (challenge.circuit),
// so a challenge that's about the CODE doesn't make the learner rebuild the
// same LED-and-resistor circuit by hand first. Loaded onto the board by
// board.loadCircuit() - see there for the shape.
//
// Positions are SVG coordinates on the 780px-wide board: components sit in
// the breadboard tray (y ~289), placed under the Arduino pin they're wired
// to so the jumper wires stay short. Ground wires land on a hole of the top
// GND rail (gnd-railtop-<n>), right next to the component.

// Pin 13 -> 220Ω resistor -> LED (anode) ... LED (cathode) -> GND - the
// standard "Arduino pin -> resistor -> LED -> GND" circuit from the LEDs and
// Resistors lesson. The resistor sits right under pin 13 (and, being
// unpolarized, takes the pin on its right-hand lead) so no wire crosses.
const LED_ON_PIN_13 = {
  components: [
    { id: "resistor-1", kind: "resistor", x: 660, y: 289, ohms: 220 },
    { id: "led-1", kind: "led", x: 560, y: 289, color: "#ff5a4e" },
  ],
  wires: [
    { from: "pin-13", to: "resistor-1-2" },
    { from: "resistor-1-1", to: "led-1-a" },
    { from: "led-1-k", to: "gnd-railtop-28" },
  ],
};

export const STARTING_CIRCUITS = {
  ledOnPin13: LED_ON_PIN_13,

  // The same LED on pin 13, plus a push button between pin 7 and GND - wired
  // for INPUT_PULLUP (pressed pulls the pin LOW).
  buttonAndLed: {
    components: [
      ...LED_ON_PIN_13.components,
      { id: "button-1", kind: "button", x: 440, y: 289 },
    ],
    wires: [
      ...LED_ON_PIN_13.wires,
      { from: "pin-7", to: "button-1-1" }, // -1 is the button's signal lead (see board.js digitalRead)
      { from: "button-1-2", to: "gnd-railtop-21" },
    ],
  },
};
