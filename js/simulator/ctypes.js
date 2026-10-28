// The number rules of Arduino C++ on an Arduino Uno (ATmega328P), applied by
// the interpreter so a sketch calculates and prints exactly what a real
// board would. JavaScript has only one number type (a 64-bit float), so
// without this layer `int a = 7; a / 2` would give 3.5 instead of 3, an
// int would never overflow, and Serial.println(3.14159) would print every
// digit instead of the "3.14" a real Uno prints.
//
// Types are plain strings:
//   "char"  - 8-bit signed      "byte" - 8-bit unsigned (also uint8_t, unsigned char)
//   "int"   - 16-bit signed     "uint" - 16-bit unsigned (unsigned int, word)
//   "long"  - 32-bit signed     "ulong" - 32-bit unsigned (unsigned long)
//   "bool", "float" (float and double are both 32-bit on the Uno),
//   "String" (Arduino String object), "cstr" (a "text literal"), "void",
//   and library object types ("Servo", "LiquidCrystal").

export const INT_TYPES = {
  char: { bits: 8, signed: true, min: -128, max: 127 },
  byte: { bits: 8, signed: false, min: 0, max: 255 },
  int: { bits: 16, signed: true, min: -32768, max: 32767 },
  uint: { bits: 16, signed: false, min: 0, max: 65535 },
  long: { bits: 32, signed: true, min: -2147483648, max: 2147483647 },
  ulong: { bits: 32, signed: false, min: 0, max: 4294967295 },
};

// How each type is spelled in messages shown to the learner.
const TYPE_LABELS = {
  char: "char", byte: "byte", int: "int", uint: "unsigned int", long: "long",
  ulong: "unsigned long", bool: "bool", float: "float", String: "String",
  cstr: "text in quotes", void: "void",
};
export const typeLabel = (t) => TYPE_LABELS[t] ?? t;

export const isIntegerType = (t) => t in INT_TYPES || t === "bool";
export const isNumericType = (t) => isIntegerType(t) || t === "float";
export const isTextType = (t) => t === "String" || t === "cstr";
export const isObjectType = (t) => t === "Servo" || t === "LiquidCrystal";

export function truthy(v) {
  return v !== 0 && v !== false && v !== "" && v != null && !Number.isNaN(v);
}

function toNumber(v) {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  return NaN;
}

// Squeezes a whole number into a fixed-width integer type, exactly the way
// the hardware does: the extra high bits are simply thrown away, so 40000 in
// a 16-bit int comes out as -25536. (JavaScript's bitwise operators work on
// 32 bits, which is what makes this a one-liner per type.)
export function wrapInt(n, type) {
  if (!Number.isFinite(n)) return 0;
  n = Math.trunc(n);
  switch (type) {
    case "char": return (n << 24) >> 24;
    case "byte": return n & 0xff;
    case "int": return (n << 16) >> 16;
    case "uint": return n & 0xffff;
    case "long": return n | 0;
    case "ulong": return n >>> 0;
    default: return n;
  }
}

// Does this exact value fit in the type without wrapping?
export function fitsIn(n, type) {
  const info = INT_TYPES[type];
  if (!info) return true;
  const t = Math.trunc(n);
  return Number.isFinite(t) && t >= info.min && t <= info.max;
}

// C's "integer promotion": anything smaller than int is widened to int
// before arithmetic.
export function promote(t) {
  return t === "bool" || t === "char" || t === "byte" ? "int" : t;
}

const RANK = { int: 1, uint: 2, long: 3, ulong: 4 };

// C's "usual arithmetic conversions": the type both sides of + - * / and so
// on are converted to first. On the Uno a long can hold every unsigned int,
// so long beats unsigned int.
export function commonType(a, b) {
  if (a === "float" || b === "float") return "float";
  a = promote(a);
  b = promote(b);
  return RANK[a] >= RANK[b] ? a : b;
}

// Converts a value from one type to another, as an assignment, a function
// argument or a cast would.
export function convert(value, fromType, toType) {
  if (toType === fromType && toType !== "float") return value;
  if (toType === "bool") return truthy(value);
  if (toType === "float") return Math.fround(toNumber(value));
  if (toType in INT_TYPES) return wrapInt(toNumber(value), toType);
  if (toType === "String") return typeof value === "string" ? value : formatValue(value, fromType);
  return value;
}

// ---------------------------------------------------------------- printing

// A straight port of Arduino's Print::printFloat(): two decimal places by
// default, "nan" / "inf" / "ovf" for the special cases, and the same
// round-half-up step, done in 32-bit float precision like the Uno.
export function printFloat(number, digits = 2) {
  if (Number.isNaN(number)) return "nan";
  if (!Number.isFinite(number)) return "inf";
  if (number > 4294967040.0 || number < -4294967040.0) return "ovf";
  let out = "";
  if (number < 0) {
    out += "-";
    number = -number;
  }
  let rounding = 0.5;
  for (let i = 0; i < digits; ++i) rounding /= 10.0;
  number = Math.fround(number + rounding);
  const intPart = Math.floor(number);
  let remainder = Math.fround(number - intPart);
  out += String(intPart);
  if (digits > 0) out += ".";
  while (digits-- > 0) {
    remainder = Math.fround(remainder * 10.0);
    const digit = Math.trunc(remainder);
    out += String(digit);
    remainder = Math.fround(remainder - digit);
  }
  return out;
}

// How Serial.print() / lcd.print() / String(x) turn a value into text.
// `arg` is print's optional second argument: a number base (DEC, HEX, OCT,
// BIN) for whole numbers, or how many decimal places for a float.
export function formatValue(value, type, arg) {
  if (type === "String" || type === "cstr") return String(value);
  if (type === "float") return printFloat(value, arg ?? 2);
  if (type === "char" && arg === undefined) return String.fromCharCode(value & 0xff);
  const n = typeof value === "boolean" ? (value ? 1 : 0) : value;
  const base = arg ?? 10;
  if (base === 10) return String(n);
  // Arduino prints negative numbers in other bases as their 32-bit
  // two's-complement pattern (so -1 in HEX is FFFFFFFF).
  return (n >>> 0).toString(base).toUpperCase();
}

// -------------------------------------------------------------- arithmetic

// One binary operator on two typed values. Returns { value, type }, plus
// `exact` (the mathematically true answer) when an integer result had to
// wrap around - the interpreter turns that into an overflow warning.
// Division or remainder by zero throws a plain Error with
// `divideByZero: true`, which the interpreter re-throws with a line number.
export function arith(op, l, lt, r, rt) {
  // A shift's result has the (promoted) type of its LEFT side only.
  const isShift = op === "<<" || op === ">>";
  const type = isShift ? promote(lt) : commonType(lt, rt);
  if (type === "float") {
    const a = toNumber(l);
    const b = toNumber(r);
    let v;
    switch (op) {
      case "+": v = a + b; break;
      case "-": v = a - b; break;
      case "*": v = a * b; break;
      case "/": v = a / b; break;
      default: throw new Error(`operator ${op} needs whole numbers`);
    }
    return { value: Math.fround(v), type };
  }

  const a = convert(l, lt, type);
  const b = isShift ? convert(r, rt, promote(rt)) : convert(r, rt, type);
  const signed = INT_TYPES[type].signed;
  let exact;
  let value;
  switch (op) {
    case "+": exact = a + b; break;
    case "-": exact = a - b; break;
    case "*":
      exact = a * b;
      // Math.imul gives the exact low 32 bits even when a*b is too big for
      // a JavaScript number to hold precisely.
      if (type === "long" || type === "ulong") value = wrapInt(Math.imul(a, b), type);
      break;
    case "/":
    case "%":
      if (b === 0) {
        const err = new Error("division by zero");
        err.divideByZero = true;
        throw err;
      }
      exact = op === "/" ? Math.trunc(a / b) : a % b;
      break;
    case "&": exact = a & b; break;
    case "|": exact = a | b; break;
    case "^": exact = a ^ b; break;
    case "<<": exact = a * 2 ** (b & 31); break;
    case ">>": exact = signed ? a >> (b & 31) : Math.floor(a / 2 ** (b & 31)); break;
    default: throw new Error(`unknown operator ${op}`);
  }
  if (value === undefined) value = wrapInt(exact, type);
  const result = { value, type };
  if (signed && value !== exact && ["+", "-", "*", "<<"].includes(op)) result.exact = exact;
  return result;
}

// == != < <= > >= on two typed values (numbers compare after the usual
// conversions; two pieces of text compare by their characters, like
// Arduino's String class does).
export function compare(op, l, lt, r, rt) {
  let a;
  let b;
  if (isTextType(lt) && isTextType(rt)) {
    a = String(l);
    b = String(r);
  } else {
    const type = commonType(lt, rt);
    a = convert(l, lt, type);
    b = convert(r, rt, type);
  }
  switch (op) {
    case "==": return a === b;
    case "!=": return a !== b;
    case "<": return a < b;
    case "<=": return a <= b;
    case ">": return a > b;
    case ">=": return a >= b;
    default: throw new Error(`unknown comparison ${op}`);
  }
}
