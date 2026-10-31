// The electronics behind the Electronics Engineering pathway's calculated
// demonstrations. These are the standard textbook models, kept separate from
// the screens that draw them so the tests can check every number:
//   Ohm's law (V = I × R) and power (P = V × I = I² × R),
//   series and parallel resistance, Kirchhoff's voltage and current laws,
//   the voltage divider (with and without a load), pull-up / pull-down
//   inputs, RC charging, and an NPN transistor used as a switch.
// They're idealised on purpose (a fixed LED forward voltage, a fixed 0.7 V
// base-emitter drop) - each screen that uses them says so.

export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
export const QUARTER_WATT = 0.25;
export const PIN_LIMIT_MA = 20; // recommended; 40 mA is the absolute maximum

export const ohms = (r) => (r >= 1e6 ? `${+(r / 1e6).toFixed(2)}MΩ` : r >= 1000 ? `${+(r / 1000).toFixed(2)}kΩ` : `${+r.toFixed(1)}Ω`);
export const mA = (amps) => amps * 1000;

// Ohm's law and power for one resistor with V across it.
export function resistorPower(volts, r) {
  const current = volts / r;
  const power = volts * current;
  return { current, power, ok: power <= QUARTER_WATT / 2, rating: power <= QUARTER_WATT / 2 ? "fine for a ¼ W resistor" : power <= QUARTER_WATT ? "within ¼ W, but with no safety margin - use a ½ W resistor" : "over ¼ W - the resistor will overheat; use a bigger value or a higher-power resistor" };
}

export const series = (rs) => rs.reduce((a, b) => a + b, 0);
export const parallel = (rs) => 1 / rs.reduce((a, r) => a + 1 / r, 0);

// One loop: supply → resistor → LED → back. Kirchhoff's voltage law: the
// drops add up to the supply. Below the LED's forward voltage it doesn't
// conduct at all (idealised), so all the supply appears across the LED.
export function ledLoop(supply, forward, r) {
  if (supply <= forward) return { current: 0, vResistor: 0, vLed: supply, conducts: false };
  const current = (supply - forward) / r;
  return { current, vResistor: current * r, vLed: forward, conducts: true };
}

// Kirchhoff's current law at the node where parallel branches split.
export function branchCurrents(supply, forward, rs) {
  const branches = rs.map((r) => ledLoop(supply, forward, r).current);
  return { branches, total: branches.reduce((a, b) => a + b, 0) };
}

// Vout = Vin × R2 / (R1 + R2). A load across R2 is in parallel with it, which
// pulls Vout down - why a divider is for measuring, not for powering things.
export function divider(vin, r1, r2, load = null) {
  const bottom = load ? parallel([r2, load]) : r2;
  const vout = (vin * bottom) / (r1 + bottom);
  return { vout, bottom, current: vin / (r1 + bottom), reading: adcReading(vout) };
}

// What analogRead() gives for a voltage on a 5 V Uno: 0-1023 (10 bits),
// rounded to the nearest step. (The chip actually rounds down to
// floor(V × 1024 / 5); the difference is one step at most.)
export const adcReading = (volts) => Math.max(0, Math.min(1023, Math.round((volts / 5) * 1023)));
export const readingToVolts = (reading) => (reading * 5) / 1023;

// A button input. mode: "pullup" (button to GND, resistor to 5V),
// "pulldown" (button to 5V, resistor to GND) or "none" (no resistor).
// Returns the pin's voltage (null = floating), the reading, and the current
// through the resistor.
export function buttonInput(mode, pressed, r) {
  if (mode === "pullup") return pressed ? { volts: 0, reading: "LOW", current: 5 / r } : { volts: 5, reading: "HIGH", current: 0 };
  if (mode === "pulldown") return pressed ? { volts: 5, reading: "HIGH", current: 5 / r } : { volts: 0, reading: "LOW", current: 0 };
  return pressed ? { volts: 0, reading: "LOW", current: null } : { volts: null, reading: "random", current: 0 };
}

// A capacitor charging through a resistor: V(t) = Vs × (1 − e^(−t / RC)).
export const timeConstant = (r, c) => r * c;
export const rcVoltage = (vs, r, c, t) => vs * (1 - Math.exp(-t / (r * c)));

// The largest E12 value not above `r` - rounding a base resistor DOWN gives a
// little more base current, which keeps the transistor fully on.
export function e12AtOrBelow(r) {
  let best = 10;
  for (let decade = 1; decade <= 1e6; decade *= 10) {
    for (const v of E12) {
      const value = Math.round(v * decade * 10) / 10;
      if (value <= r) best = value;
    }
  }
  return best;
}

// An NPN transistor switching a load from a 5 V pin. To be sure it's fully
// on (saturated), the usual rule of thumb is base current = load current ÷ 10
// - far more than the minimum gain (hFE) needs.
export function transistorSwitch(loadMilliamps, hfe = 100, { vPin = 5, vbe = 0.7, forcedBeta = 10 } = {}) {
  const ic = loadMilliamps / 1000;
  const ibMin = ic / hfe;
  const ibDesign = ic / forcedBeta;
  const rbExact = (vPin - vbe) / ibDesign;
  const rb = e12AtOrBelow(rbExact);
  const ibActual = (vPin - vbe) / rb;
  return {
    ibMin, ibDesign, rbExact, rb, ibActual,
    pinOk: ibActual * 1000 <= PIN_LIMIT_MA,
    directOk: loadMilliamps <= PIN_LIMIT_MA,
  };
}
