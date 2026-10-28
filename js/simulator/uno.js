// Facts about the Arduino Uno's pins, shared by the interpreter (which uses
// them to warn about mistakes) and the board (which uses them to behave
// like the real hardware). Kept in one place so the two can never disagree.

// Only these pins have hardware PWM on an Uno - the ones marked "~" on the
// board. analogWrite() on any other pin can only switch it fully on or off.
export const PWM_PINS = new Set([3, 5, 6, 9, 10, 11]);

// pinMode() modes, by the numbers the Arduino core uses for them.
export const MODE_INPUT = 0;
export const MODE_OUTPUT = 1;
export const MODE_INPUT_PULLUP = 2;
export const MODE_NAMES = { [MODE_INPUT]: "INPUT", [MODE_OUTPUT]: "OUTPUT", [MODE_INPUT_PULLUP]: "INPUT_PULLUP" };

// Digital pins 0-13, plus the analog pins A0-A5, which the Uno numbers 14-19
// internally (so analogRead(A0) and digitalRead(14) mean the same pin).
export const isValidPin = (pin) => Number.isInteger(pin) && pin >= 0 && pin <= 19;
export const isAnalogPin = (pin) => pin >= 14 && pin <= 19;

export function pinName(pin) {
  return isAnalogPin(pin) ? `A${pin - 14}` : String(pin);
}

// What analogWrite(pin, value) really puts out on an Uno, as a 0-255 level.
// It mirrors the Arduino core's own analogWrite(): 0 and 255 are plain
// LOW/HIGH; a PWM pin otherwise keeps only the lowest 8 bits of the value
// (its timer register is 8 bits wide, so 300 becomes 44); and a pin without
// PWM can only switch fully on (128 or more) or fully off (below 128).
export function analogWriteLevel(pin, value) {
  if (value === 0) return 0;
  if (value === 255) return 255;
  if (!PWM_PINS.has(pin)) return value < 128 ? 0 : 255;
  return value & 0xff;
}
