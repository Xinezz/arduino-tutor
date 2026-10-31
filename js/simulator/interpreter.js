// A small interpreter for a SUBSET of Arduino C++ - enough to run the code
// taught in this course: variables of the Uno's real types, if/else, for/
// while, custom functions with parameters and return values, and the
// built-in pinMode/digitalWrite/digitalRead/analogRead/analogWrite/delay/
// millis/Serial functions (plus the Servo and LiquidCrystal libraries).
// This is NOT a real C++ compiler - it's a tree-walking interpreter, the
// same basic technique used by simple scripting-language engines. The full
// list of what is and isn't supported lives in docs/arduino-language-support.md.
//
// Pipeline:
//   source text -> tokenize()  (which also applies #define and skips #include)
//               -> parse()     -> an AST (Abstract Syntax Tree: a tree of
//                                 objects describing the program's structure)
//               -> analyze()   -> the "compile" step: every name, type,
//                                 const, function call and return is checked
//                                 BEFORE anything runs, so mistakes are
//                                 reported with a line number up front, the
//                                 way the Arduino IDE's Verify button does
//               -> run()       -> walks the tree and executes it against a
//                                 hardware API (see board.js) supplied by the
//                                 caller.
//
// Numbers follow the Uno's real rules (see ctypes.js): an int is 16 bits,
// whole-number division drops the remainder, and Serial.print() of a float
// shows two decimal places - so a sketch prints here exactly what it would
// print on a real board.
//
// delay() is the tricky part: real Arduino code blocks for N milliseconds.
// We can't freeze the browser tab for that long, so the evaluator is written
// as a generator function (function*) - calling delay() does `yield` instead
// of blocking, handing control back to a scheduler (startProgram at the
// bottom) which waits the right amount of *real* time before resuming
// exactly where execution left off. This is also what lets a button click
// affect a digitalRead() that hasn't happened yet - the program genuinely
// pauses.

import {
  INT_TYPES, typeLabel, isIntegerType, isNumericType, isTextType, isObjectType,
  truthy, convert, fitsIn, promote, commonType, formatValue, arith, compare,
} from "./ctypes.js";
import {
  PWM_PINS, MODE_INPUT, MODE_OUTPUT, MODE_INPUT_PULLUP, MODE_NAMES,
  isValidPin, isAnalogPin, pinName,
} from "./uno.js";

export class SimError extends Error {
  constructor(message, line) {
    super(line ? `Line ${line}: ${message}` : message);
    this.line = line;
  }
}

// =================================================================== tokenizer

const KEYWORDS = new Set([
  "void", "int", "float", "double", "bool", "boolean", "char", "long", "short", "byte", "word",
  "unsigned", "signed", "String", "const", "static", "volatile",
  "if", "else", "for", "while", "do", "switch", "case", "default",
  "return", "break", "continue", "true", "false",
]);

const OPERATORS = [
  "<<=", ">>=",
  "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=",
  "&=", "|=", "^=", "<<", ">>", "->", "::",
];
const SINGLE_CHAR_OPS = "{}()[];,.+-*/%<>=!&|^~?:";

const ESCAPES = { n: "\n", t: "\t", r: "\r", 0: "\0", "\\": "\\", '"': '"', "'": "'", a: "\x07", b: "\b", f: "\f", v: "\v" };

// The type of a whole-number literal, picked the way C picks it: the first
// type in the list that can hold the value (so 40000 is a long on an Uno,
// because it doesn't fit in a 16-bit int).
function integerLiteralType(value, radix, unsigned, long) {
  let candidates;
  if (unsigned) candidates = long ? ["ulong"] : ["uint", "ulong"];
  else if (long) candidates = ["long", "ulong"];
  else candidates = radix === 10 ? ["int", "long", "ulong"] : ["int", "uint", "long", "ulong"];
  return candidates.find((t) => fitsIn(value, t)) ?? null;
}

// Scans source text into tokens, calling emit(token) for each one and
// onDirective(text, line) for every #-line. Returns the last line number.
function scan(text, startLine, emit, onDirective) {
  const n = text.length;
  let i = 0;
  let line = startLine;
  let atLineStart = true; // only whitespace seen since the last newline

  while (i < n) {
    const c = text[i];
    if (c === "\n") { line++; i++; atLineStart = true; continue; }
    if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v") { i++; continue; }

    if (c === "#" && atLineStart && onDirective) {
      let j = i;
      while (j < n && text[j] !== "\n") j++;
      onDirective(text.slice(i + 1, j), line);
      i = j;
      continue;
    }
    atLineStart = false;

    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const openedOn = line;
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] === "\n") line++;
        i++;
      }
      if (i >= n) throw new SimError("This /* comment is never closed with */", openedOn);
      i += 2;
      continue;
    }

    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      const start = i;
      let radix = 10;
      let value;
      let isFloat = false;
      if (c === "0" && /[xX]/.test(text[i + 1] ?? "")) {
        radix = 16;
        i += 2;
        const s = i;
        while (i < n && /[0-9a-fA-F]/.test(text[i])) i++;
        value = parseInt(text.slice(s, i), 16);
      } else if (c === "0" && /[bB]/.test(text[i + 1] ?? "") && /[01]/.test(text[i + 2] ?? "")) {
        radix = 2;
        i += 2;
        const s = i;
        while (i < n && /[01]/.test(text[i])) i++;
        value = parseInt(text.slice(s, i), 2);
      } else {
        while (i < n && /[0-9]/.test(text[i])) i++;
        if (text[i] === ".") {
          isFloat = true;
          i++;
          while (i < n && /[0-9]/.test(text[i])) i++;
        }
        if (/[eE]/.test(text[i] ?? "") && /[0-9+-]/.test(text[i + 1] ?? "")) {
          isFloat = true;
          i += 2;
          while (i < n && /[0-9]/.test(text[i])) i++;
        }
        const digits = text.slice(start, i);
        if (!isFloat && digits.length > 1 && digits[0] === "0") {
          // A leading zero means octal (base 8) in C - 010 is eight, not ten.
          if (/[89]/.test(digits)) throw new SimError(`${digits} isn't a valid number: a leading 0 means base 8 in C, which has no 8 or 9`, line);
          radix = 8;
          value = parseInt(digits, 8);
        } else {
          value = isFloat ? parseFloat(digits) : parseInt(digits, 10);
        }
      }
      let unsigned = false;
      let long = false;
      while (i < n && /[uUlLfF]/.test(text[i])) {
        const s = text[i].toLowerCase();
        if (s === "u") unsigned = true;
        else if (s === "l") long = true;
        else if (s === "f" && radix === 10) isFloat = true;
        else break;
        i++;
      }
      if (i < n && /[A-Za-z0-9_.]/.test(text[i])) {
        throw new SimError(`'${text.slice(start, i + 1)}' isn't a valid number`, line);
      }
      let ctype = "float";
      if (!isFloat) {
        ctype = integerLiteralType(value, radix, unsigned, long);
        if (!ctype) throw new SimError(`${text.slice(start, i)} is too big for any whole-number type on an Arduino Uno (the largest is 4294967295)`, line);
      }
      emit({ type: "NUMBER", value: ctype === "float" ? Math.fround(value) : value, ctype, line });
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < n && /[A-Za-z0-9_]/.test(text[i])) i++;
      const word = text.slice(start, i);
      // Arduino's binary constants (B101, B11111111) are really macros from
      // binary.h - treat them as the numbers they stand for.
      if (/^B[01]{1,8}$/.test(word)) {
        emit({ type: "NUMBER", value: parseInt(word.slice(1), 2), ctype: "int", line });
      } else {
        emit({ type: KEYWORDS.has(word) ? "KEYWORD" : "IDENT", value: word, line });
      }
      continue;
    }

    if (c === '"') {
      i++;
      let out = "";
      while (i < n && text[i] !== '"') {
        if (text[i] === "\n") throw new SimError('This text in quotes is never closed - add the closing "', line);
        if (text[i] === "\\" && i + 1 < n) {
          const e = text[i + 1];
          out += e in ESCAPES ? ESCAPES[e] : e;
          i += 2;
        } else {
          out += text[i];
          i++;
        }
      }
      if (i >= n) throw new SimError('This text in quotes is never closed - add the closing "', line);
      i++;
      emit({ type: "STRING", value: out, line });
      continue;
    }

    if (c === "'") {
      i++;
      let ch;
      if (text[i] === "\\") {
        const e = text[i + 1];
        ch = e in ESCAPES ? ESCAPES[e] : e;
        i += 2;
      } else {
        ch = text[i];
        i++;
      }
      if (text[i] !== "'" || ch === undefined || ch === "\n") {
        throw new SimError("A char literal holds exactly one character between single quotes, like 'A' - use double quotes for text", line);
      }
      i++;
      emit({ type: "CHAR", value: ch.charCodeAt(0), line });
      continue;
    }

    const op = OPERATORS.find((o) => text.startsWith(o, i));
    if (op) {
      emit({ type: "OP", value: op, line });
      i += op.length;
      continue;
    }
    if (SINGLE_CHAR_OPS.includes(c)) {
      emit({ type: "OP", value: c, line });
      i++;
      continue;
    }

    throw new SimError(`Unrecognized character '${c}'`, line);
  }
  return line;
}

// Turns source text into tokens. #define works the way the real C
// preprocessor does it: on whole tokens, from the line it's defined on
// downward - so it never reaches inside "text in quotes" and doesn't affect
// code above the #define.
export function tokenize(source) {
  const tokens = [];
  const macros = new Map(); // name -> the tokens it stands for

  function emit(tok, expanding) {
    if (tok.type === "IDENT" && macros.has(tok.value) && !(expanding && expanding.has(tok.value))) {
      const inside = new Set(expanding || []);
      inside.add(tok.value);
      for (const t of macros.get(tok.value)) emit({ ...t, line: tok.line }, inside);
      return;
    }
    tokens.push(tok);
  }

  function onDirective(text, line) {
    const m = text.match(/^\s*([A-Za-z_]\w*)([\s\S]*)$/);
    if (!m) throw new SimError("A line starting with # needs a directive such as #define or #include", line);
    const [, directive, rest] = m;
    if (directive === "include") return; // Servo and LiquidCrystal are built in - nothing to load
    if (directive === "define") {
      const dm = rest.match(/^\s+([A-Za-z_]\w*)(\()?/);
      if (!dm) throw new SimError("#define needs a name, like #define LED_PIN 13", line);
      if (dm[2]) {
        throw new SimError(`#define ${dm[1]}(...) - macros that take arguments aren't supported in this simulator. Write a function instead.`, line);
      }
      const body = [];
      scan(rest.slice(dm[0].length), line, (t) => body.push(t), null);
      macros.set(dm[1], body);
      return;
    }
    if (directive === "undef") {
      macros.delete(rest.trim());
      return;
    }
    throw new SimError(`#${directive} isn't supported in this simulator (only #define and #include are)`, line);
  }

  const lastLine = scan(source, 1, (t) => emit(t, null), onDirective);
  tokens.push({ type: "EOF", value: null, line: lastLine });
  return tokens;
}

// ====================================================================== parser
// Turns the flat token list into a tree. Each parseX() function corresponds to
// one grammar rule; this structure mirrors how real compilers are built.

const TYPE_WORDS = new Set(["void", "int", "float", "double", "bool", "boolean", "char", "long", "short", "byte", "word", "unsigned", "signed", "String"]);
const QUALIFIERS = new Set(["const", "static", "volatile"]);
const TYPEDEFS = { uint8_t: "byte", int8_t: "char", uint16_t: "uint", int16_t: "int", uint32_t: "ulong", int32_t: "long", size_t: "uint" };
const LIBRARY_TYPES = new Set(["Servo", "LiquidCrystal"]);

// C++ keywords and features this simulator doesn't run. Seeing one produces a
// clear "not supported" message instead of a confusing syntax error.
const UNSUPPORTED_WORDS = {
  struct: "Structs aren't supported in this simulator yet - use separate variables instead.",
  class: "Classes aren't supported in this simulator.",
  enum: "enum isn't supported in this simulator yet - use const int values instead.",
  union: "union isn't supported in this simulator.",
  typedef: "typedef isn't supported in this simulator.",
  namespace: "namespace isn't supported in this simulator.",
  template: "Templates aren't supported in this simulator.",
  using: "'using' isn't supported in this simulator.",
  goto: "goto isn't supported in this simulator.",
  sizeof: "sizeof isn't supported in this simulator yet (it's mostly used with arrays, which aren't supported yet either).",
  new: "'new' (dynamic memory) isn't supported in this simulator.",
  delete: "'delete' (dynamic memory) isn't supported in this simulator.",
  auto: "'auto' isn't supported in this simulator - write the type out (int, float, ...).",
  extern: "'extern' isn't supported in this simulator.",
  inline: "'inline' isn't supported in this simulator - just leave it out.",
  operator: "Operator overloading isn't supported in this simulator.",
  uint64_t: "64-bit numbers aren't supported - the Uno's biggest whole-number type is the 32-bit long.",
  int64_t: "64-bit numbers aren't supported - the Uno's biggest whole-number type is the 32-bit long.",
};

const ARRAYS_UNSUPPORTED =
  "Arrays aren't supported in this simulator yet (they're planned) - for now, use a separate variable for each value.";

const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="]);
const BINARY_LEVELS = [
  ["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", "<=", ">", ">="], ["<<", ">>"], ["+", "-"], ["*", "/", "%"],
];

function describeToken(t) {
  if (t.type === "EOF") return "the end of the code";
  if (t.type === "STRING") return `"${t.value}"`;
  if (t.type === "CHAR") return `'${String.fromCharCode(t.value)}'`;
  return `'${t.value}'`;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(offset = 0) { return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]; }
  // At a '(' : does the matching ')' come straight before a '{'? (a function body)
  looksLikeFunctionDefinition() {
    let depth = 0;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type !== "OP") continue;
      if (t.value === "(") depth++;
      else if (t.value === ")" && --depth === 0) {
        const next = this.tokens[i + 1];
        return !!next && next.type === "OP" && next.value === "{";
      }
    }
    return false;
  }
  advance() { return this.tokens[this.pos++]; }
  check(type, value) {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }
  match(type, value) { return this.check(type, value) ? this.advance() : null; }

  expect(type, value, what) {
    const t = this.match(type, value);
    if (t) return t;
    const found = this.peek();
    if (value === ";") {
      // A missing semicolon is noticed at the NEXT token, often on the next
      // line - point at the line the semicolon is actually missing from.
      const prev = this.tokens[this.pos - 1];
      if (prev && prev.line < found.line) {
        throw new SimError(`Missing ';' at the end of this line`, prev.line);
      }
      throw new SimError(`Expected ';' before ${describeToken(found)}`, found.line);
    }
    throw new SimError(`Expected ${what || `'${value}'`} but found ${describeToken(found)}`, found.line);
  }

  rejectUnsupported() {
    const t = this.peek();
    if (t.type === "IDENT" && UNSUPPORTED_WORDS[t.value]) throw new SimError(UNSUPPORTED_WORDS[t.value], t.line);
    if (t.type === "KEYWORD" && (t.value === "switch" || t.value === "case" || t.value === "default")) {
      throw new SimError("switch / case isn't supported in this simulator yet - use if / else if instead.", t.line);
    }
    if (t.type === "KEYWORD" && t.value === "do") {
      throw new SimError("do ... while loops aren't supported in this simulator yet - use a while loop instead.", t.line);
    }
  }

  // ---- types ----

  isTypeStart() {
    const t = this.peek();
    if (t.type === "KEYWORD") return TYPE_WORDS.has(t.value) || QUALIFIERS.has(t.value);
    if (t.type !== "IDENT") return false;
    if (t.value in TYPEDEFS || LIBRARY_TYPES.has(t.value)) return true;
    // Two names in a row ("Servo myServo", "Adafruit_NeoPixel strip") can only
    // be a declaration - a bare name can never be followed directly by
    // another bare name in an expression.
    return this.peek(1).type === "IDENT";
  }

  parseTypeSpec() {
    const line = this.peek().line;
    const spec = { isConst: false, isStatic: false, line };
    const words = [];
    let named = null;
    for (;;) {
      const t = this.peek();
      if (t.type === "KEYWORD" && QUALIFIERS.has(t.value)) {
        this.advance();
        if (t.value === "const") spec.isConst = true;
        if (t.value === "static") spec.isStatic = true;
        continue; // volatile only matters for interrupts, which aren't simulated - accepted, no effect
      }
      if (t.type === "KEYWORD" && TYPE_WORDS.has(t.value)) {
        this.advance();
        words.push(t.value);
        continue;
      }
      if (t.type === "IDENT" && words.length === 0 && named === null) {
        if (UNSUPPORTED_WORDS[t.value]) throw new SimError(UNSUPPORTED_WORDS[t.value], t.line);
        if (t.value in TYPEDEFS || LIBRARY_TYPES.has(t.value) || this.peek(1).type === "IDENT") {
          this.advance();
          named = t.value;
          continue;
        }
      }
      break;
    }
    if (!words.length && named === null) {
      throw new SimError(`Expected a type (like int or float) but found ${describeToken(this.peek())}`, this.peek().line);
    }
    spec.type = this.normalizeType(words, named, line);
    if (this.check("OP", "*") || this.check("OP", "&")) {
      throw new SimError("Pointers and references ('*' or '&' after a type) aren't supported in this simulator - use a plain variable, or String for text.", this.peek().line);
    }
    return spec;
  }

  normalizeType(words, named, line) {
    if (named !== null) {
      if (named in TYPEDEFS) return TYPEDEFS[named];
      if (LIBRARY_TYPES.has(named)) return named;
      return `unknown:${named}`;
    }
    const has = (w) => words.includes(w);
    const longs = words.filter((w) => w === "long").length;
    if (has("void")) return "void";
    if (has("String")) return "String";
    if (has("float") || has("double")) return "float";
    if (has("bool") || has("boolean")) return "bool";
    if (has("byte")) return "byte";
    if (has("word")) return "uint";
    if (longs >= 2) throw new SimError(UNSUPPORTED_WORDS.int64_t, line);
    if (has("char")) return has("unsigned") ? "byte" : "char";
    if (longs === 1) return has("unsigned") ? "ulong" : "long";
    return has("unsigned") ? "uint" : "int";
  }

  // ---- top level ----

  parseProgram() {
    const items = [];
    while (!this.check("EOF")) {
      if (this.match("OP", ";")) continue;
      this.rejectUnsupported();
      if (!this.isTypeStart()) {
        const t = this.peek();
        throw new SimError(
          `Code outside of a function has to be a declaration (like int ledPin = 13;) or a function (like void setup() { ... }), but found ${describeToken(t)}`,
          t.line
        );
      }
      const spec = this.parseTypeSpec();
      const nameTok = this.expect("IDENT", undefined, "a name");
      const isLibraryObject = LIBRARY_TYPES.has(spec.type) || spec.type.startsWith("unknown:");
      if (this.check("OP", "(") && !isLibraryObject) {
        items.push(this.parseFunctionRest(spec, nameTok));
      } else {
        items.push(this.parseVarDeclRest(spec, nameTok));
        this.expect("OP", ";");
      }
    }
    return { type: "Program", items };
  }

  parseFunctionRest(spec, nameTok) {
    this.expect("OP", "(");
    const params = [];
    if (this.check("KEYWORD", "void") && this.peek(1).type === "OP" && this.peek(1).value === ")") {
      this.advance();
    } else if (!this.check("OP", ")")) {
      do {
        const pspec = this.parseTypeSpec();
        const pname = this.expect("IDENT", undefined, "a parameter name");
        if (this.check("OP", "[")) throw new SimError(ARRAYS_UNSUPPORTED, this.peek().line);
        if (this.check("OP", "=")) throw new SimError("Default values for parameters aren't supported in this simulator.", this.peek().line);
        params.push({ name: pname.value, type: pspec.type, line: pname.line });
      } while (this.match("OP", ","));
    }
    this.expect("OP", ")");
    const fn = { type: "Function", name: nameTok.value, returnType: spec.type, params, line: nameTok.line, body: null };
    if (this.match("OP", ";")) return { ...fn, type: "Prototype" };
    if (!this.check("OP", "{")) {
      throw new SimError(`Expected '{' to start the body of ${nameTok.value}() but found ${describeToken(this.peek())}`, this.peek().line);
    }
    this.currentFunction = fn;
    fn.body = this.parseBlock();
    this.currentFunction = null;
    fn.endLine = this.tokens[this.pos - 1].line;
    return fn;
  }

  parseVarDeclRest(spec, firstName) {
    const declarators = [this.parseDeclaratorRest(spec, firstName)];
    while (this.match("OP", ",")) {
      declarators.push(this.parseDeclaratorRest(spec, this.expect("IDENT", undefined, "a variable name")));
    }
    return { type: "VarDecl", varType: spec.type, isConst: spec.isConst, isStatic: spec.isStatic, declarators, line: spec.line };
  }

  parseDeclaratorRest(spec, nameTok) {
    const d = { name: nameTok.value, init: null, ctorArgs: null, line: nameTok.line };
    if (this.check("OP", "[")) throw new SimError(ARRAYS_UNSUPPORTED, this.peek().line);
    if (this.check("OP", "(")) {
      if (!LIBRARY_TYPES.has(spec.type) && !spec.type.startsWith("unknown:")) {
        // void loop() { ... } turning up INSIDE setup() almost always means
        // setup() is missing its closing } - say that, rather than something
        // about declarations the learner never meant to write.
        const outer = this.currentFunction;
        if (outer && (spec.type === "void" || this.looksLikeFunctionDefinition())) {
          throw new SimError(`Missing '}' - ${outer.name}() (started on line ${outer.line}) is never closed before ${d.name}() begins here. A function can't be written inside another function: add a } to end ${outer.name}() first.`, nameTok.line);
        }
        throw new SimError(`To give '${d.name}' a starting value write = (for example int ${d.name} = 5;) - a function can't be declared inside another function`, this.peek().line);
      }
      // Constructor-style declaration, e.g. LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
      // The pin numbers aren't needed for the simulation (the display isn't
      // wired pin-by-pin), but PARSING them means real Arduino code using a
      // real library still copy-pastes in without a syntax error.
      this.advance();
      d.ctorArgs = [];
      if (!this.check("OP", ")")) {
        do d.ctorArgs.push(this.parseExpr()); while (this.match("OP", ","));
      }
      this.expect("OP", ")");
    } else if (this.match("OP", "=")) {
      if (this.check("OP", "{")) throw new SimError(ARRAYS_UNSUPPORTED, this.peek().line);
      d.init = this.parseExpr();
    } else if (this.check("OP", "{")) {
      throw new SimError(`Brace initialization isn't supported - write ${d.name} = value instead`, this.peek().line);
    }
    return d;
  }

  // ---- statements ----

  parseBlock() {
    const line = this.expect("OP", "{").line;
    const stmts = [];
    while (!this.check("OP", "}")) {
      if (this.check("EOF")) throw new SimError("Missing '}' - a { was opened but never closed", line);
      stmts.push(this.parseStatement());
    }
    this.expect("OP", "}");
    return { type: "Block", stmts, line };
  }

  parseStatement() {
    const t = this.peek();
    if (this.check("OP", "{")) return this.parseBlock();
    if (this.match("OP", ";")) return { type: "Empty", line: t.line };
    if (this.check("KEYWORD", "if")) return this.parseIf();
    if (this.check("KEYWORD", "for")) return this.parseFor();
    if (this.check("KEYWORD", "while")) return this.parseWhile();
    if (this.check("KEYWORD", "break") || this.check("KEYWORD", "continue")) {
      this.advance();
      this.expect("OP", ";");
      return { type: t.value === "break" ? "Break" : "Continue", line: t.line };
    }
    if (this.check("KEYWORD", "return")) {
      this.advance();
      const expr = this.check("OP", ";") ? null : this.parseExpr();
      this.expect("OP", ";");
      return { type: "Return", expr, line: t.line };
    }
    if (this.check("KEYWORD", "else")) throw new SimError("This 'else' has no matching 'if' before it", t.line);
    this.rejectUnsupported();
    if (this.isTypeStart()) {
      const spec = this.parseTypeSpec();
      const nameTok = this.expect("IDENT", undefined, "a variable name");
      const decl = this.parseVarDeclRest(spec, nameTok);
      this.expect("OP", ";");
      return decl;
    }
    const expr = this.parseExpr();
    this.expect("OP", ";");
    return { type: "ExprStmt", expr, line: t.line };
  }

  parseIf() {
    const line = this.advance().line;
    this.expect("OP", "(");
    const cond = this.parseExpr();
    this.expect("OP", ")");
    const then = this.parseStatement();
    const elseBranch = this.match("KEYWORD", "else") ? this.parseStatement() : null;
    return { type: "If", cond, then, else: elseBranch, line };
  }

  parseFor() {
    const line = this.advance().line;
    this.expect("OP", "(");
    let init = null;
    if (!this.check("OP", ";")) {
      if (this.isTypeStart()) {
        const spec = this.parseTypeSpec();
        init = this.parseVarDeclRest(spec, this.expect("IDENT", undefined, "a variable name"));
      } else {
        const l = this.peek().line;
        init = { type: "ExprStmt", expr: this.parseExpr(), line: l };
      }
    }
    this.expect("OP", ";");
    const cond = this.check("OP", ";") ? null : this.parseExpr();
    this.expect("OP", ";");
    const update = this.check("OP", ")") ? null : this.parseExpr();
    if (this.check("OP", ",")) throw new SimError("The comma operator isn't supported - put the extra update inside the loop body instead", this.peek().line);
    this.expect("OP", ")");
    const body = this.parseStatement();
    return { type: "For", init, cond, update, body, line };
  }

  parseWhile() {
    const line = this.advance().line;
    this.expect("OP", "(");
    const cond = this.parseExpr();
    this.expect("OP", ")");
    const body = this.parseStatement();
    return { type: "While", cond, body, line };
  }

  // ---- expressions (lowest precedence first) ----

  parseExpr() {
    const left = this.parseTernary();
    if (this.peek().type === "OP" && ASSIGN_OPS.has(this.peek().value)) {
      const opTok = this.advance();
      const value = this.parseExpr(); // right-associative: a = b = 5
      return { type: "Assign", op: opTok.value, target: left, value, line: opTok.line };
    }
    return left;
  }

  parseTernary() {
    const cond = this.parseBinary(0);
    if (!this.check("OP", "?")) return cond;
    const line = this.advance().line;
    const then = this.parseExpr();
    this.expect("OP", ":");
    const otherwise = this.parseTernary();
    return { type: "Ternary", cond, then, else: otherwise, line };
  }

  parseBinary(level) {
    if (level === BINARY_LEVELS.length) return this.parseUnary();
    let left = this.parseBinary(level + 1);
    while (this.peek().type === "OP" && BINARY_LEVELS[level].includes(this.peek().value)) {
      const opTok = this.advance();
      const right = this.parseBinary(level + 1);
      left = { type: "Binary", op: opTok.value, left, right, line: opTok.line };
    }
    return left;
  }

  isCastStart() {
    // "(" followed by a type and ")" - a C-style cast like (float) x
    if (!this.check("OP", "(")) return false;
    const t = this.peek(1);
    const typeWord = (t.type === "KEYWORD" && TYPE_WORDS.has(t.value)) || (t.type === "IDENT" && t.value in TYPEDEFS);
    if (!typeWord) return false;
    let k = 1;
    while (this.peek(k).type === "KEYWORD" && TYPE_WORDS.has(this.peek(k).value)) k++;
    if (this.peek(k).type === "IDENT" && this.peek(k).value in TYPEDEFS) k++;
    return this.peek(k).type === "OP" && this.peek(k).value === ")";
  }

  parseUnary() {
    const t = this.peek();
    if (t.type === "OP" && ["!", "-", "+", "~"].includes(t.value)) {
      this.advance();
      return { type: "Unary", op: t.value, expr: this.parseUnary(), line: t.line };
    }
    if (t.type === "OP" && (t.value === "++" || t.value === "--")) {
      this.advance();
      return { type: "Update", op: t.value, target: this.parseUnary(), prefix: true, line: t.line };
    }
    if (t.type === "OP" && (t.value === "*" || t.value === "&")) {
      throw new SimError("Pointers ('*' and '&' in front of a value) aren't supported in this simulator.", t.line);
    }
    if (this.isCastStart()) {
      this.advance();
      const spec = this.parseTypeSpec();
      this.expect("OP", ")");
      return { type: "Cast", toType: spec.type, expr: this.parseUnary(), line: t.line };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.type === "OP" && (t.value === "++" || t.value === "--")) {
        this.advance();
        expr = { type: "Update", op: t.value, target: expr, prefix: false, line: t.line };
      } else if (t.type === "OP" && t.value === "[") {
        throw new SimError(ARRAYS_UNSUPPORTED, t.line);
      } else if (t.type === "OP" && (t.value === "->" || t.value === "::")) {
        throw new SimError(`'${t.value}' isn't supported in this simulator`, t.line);
      } else {
        return expr;
      }
    }
  }

  parseCallArgs() {
    this.expect("OP", "(");
    const args = [];
    if (!this.check("OP", ")")) {
      do args.push(this.parseExpr()); while (this.match("OP", ","));
    }
    this.expect("OP", ")");
    return args;
  }

  parsePrimary() {
    const t = this.peek();

    if (t.type === "NUMBER") { this.advance(); return { type: "Literal", value: t.value, ctype: t.ctype, line: t.line }; }
    if (t.type === "CHAR") { this.advance(); return { type: "Literal", value: t.value, ctype: "char", line: t.line }; }
    if (t.type === "STRING") {
      this.advance();
      let text = t.value;
      while (this.check("STRING")) text += this.advance().value; // "abc" "def" is one string in C
      return { type: "Literal", value: text, ctype: "cstr", line: t.line };
    }
    if (this.match("KEYWORD", "true")) return { type: "Literal", value: true, ctype: "bool", line: t.line };
    if (this.match("KEYWORD", "false")) return { type: "Literal", value: false, ctype: "bool", line: t.line };

    if (this.check("OP", "(")) {
      this.advance();
      const expr = this.parseExpr();
      this.expect("OP", ")");
      expr.parens = true;
      return expr;
    }

    // String(x) builds a String; int(x) / float(x) / long(x) ... are casts.
    if (t.type === "KEYWORD" && TYPE_WORDS.has(t.value) && this.peek(1).type === "OP" && this.peek(1).value === "(") {
      this.advance();
      const args = this.parseCallArgs();
      if (t.value === "String") return { type: "Call", callee: { type: "Ident", name: "String", line: t.line }, args, line: t.line };
      if (args.length !== 1) throw new SimError(`${t.value}(...) converts exactly one value`, t.line);
      return { type: "Cast", toType: this.normalizeType([t.value], null, t.line), expr: args[0], line: t.line };
    }

    if (t.type === "IDENT") {
      if (UNSUPPORTED_WORDS[t.value]) throw new SimError(UNSUPPORTED_WORDS[t.value], t.line);
      this.advance();
      let node = { type: "Ident", name: t.value, line: t.line };
      if (this.match("OP", ".")) {
        const prop = this.expect("IDENT", undefined, "a name after '.'");
        node = { type: "Member", object: node, property: prop.value, line: t.line };
        if (this.check("OP", ".")) throw new SimError("Chained '.' access isn't supported in this simulator", this.peek().line);
      }
      if (this.check("OP", "(")) {
        node = { type: "Call", callee: node, args: this.parseCallArgs(), line: t.line };
      }
      return node;
    }

    if (t.type === "KEYWORD") {
      this.rejectUnsupported();
      throw new SimError(`'${t.value}' can't be used here`, t.line);
    }
    throw new SimError(`Unexpected ${describeToken(t)}`, t.line);
  }
}

export function parse(source) {
  return new Parser(tokenize(source)).parseProgram();
}

// ================================================================== analyzer
// The "compile" step. Walks the whole program once before it runs, with the
// same scoping rules C++ uses, and:
//   - resolves every name (a misspelled variable is reported up front, with a
//     suggestion, instead of crashing halfway through a run)
//   - works out the type of every expression, which the evaluator needs to
//     do Uno-accurate arithmetic and printing
//   - rejects changes to const variables and built-in constants
//   - checks function calls (right number of arguments, of usable types)
//     and return statements (a value is returned exactly when it should be)
//   - rejects break/continue outside a loop
// It also collects a few beginner-friendly WARNINGS (code that runs, but
// probably doesn't do what was meant) - e.g. if (x = 5).

// Arduino's built-in constants. The numeric values match the real Arduino
// core, so printing OUTPUT gives 1 there and here.
const BUILTIN_CONSTANTS = {
  HIGH: ["int", 1], LOW: ["int", 0],
  INPUT: ["int", MODE_INPUT], OUTPUT: ["int", MODE_OUTPUT], INPUT_PULLUP: ["int", MODE_INPUT_PULLUP],
  LED_BUILTIN: ["int", 13],
  // A real Uno numbers its analog pins 14-19 internally (A0 = digital pin 14,
  // and so on) - matching that exactly means analogRead(A0) behaves the same
  // as real hardware, and the board's wiring (which only knows numbered
  // pins) needs no special-casing for "analog" pins.
  A0: ["int", 14], A1: ["int", 15], A2: ["int", 16], A3: ["int", 17], A4: ["int", 18], A5: ["int", 19],
  DEC: ["int", 10], HEX: ["int", 16], OCT: ["int", 8], BIN: ["int", 2],
  PI: ["float", Math.fround(Math.PI)],
};

const num = "number"; // marker: argument must be a number (any numeric type)

// Built-in functions: argument count, parameter types (arguments are
// converted to these, like a real function call), and the return type.
const BUILTINS = {
  pinMode: { usage: "pinMode(pin, mode)", args: [2, 2], params: ["int", "int"], ret: "void" },
  digitalWrite: { usage: "digitalWrite(pin, value)", args: [2, 2], params: ["int", "int"], ret: "void" },
  digitalRead: { usage: "digitalRead(pin)", args: [1, 1], params: ["int"], ret: "int" },
  analogRead: { usage: "analogRead(pin)", args: [1, 1], params: ["int"], ret: "int" },
  analogWrite: { usage: "analogWrite(pin, value)", args: [2, 2], params: ["int", "int"], ret: "void" },
  delay: { usage: "delay(milliseconds)", args: [1, 1], params: ["ulong"], ret: "void" },
  delayMicroseconds: { usage: "delayMicroseconds(microseconds)", args: [1, 1], params: ["uint"], ret: "void" },
  millis: { usage: "millis()", args: [0, 0], params: [], ret: "ulong" },
  micros: { usage: "micros()", args: [0, 0], params: [], ret: "ulong" },
  pulseIn: { usage: "pulseIn(pin, value)", args: [2, 3], params: ["int", "int", "ulong"], ret: "ulong" },
  tone: { usage: "tone(pin, frequency)", args: [2, 3], params: ["int", "uint", "ulong"], ret: "void" },
  noTone: { usage: "noTone(pin)", args: [1, 1], params: ["int"], ret: "void" },
  // abs/min/max/constrain/sq are macros on Arduino, so their result has the
  // type of whatever went in.
  abs: { usage: "abs(x)", args: [1, 1], params: [num], ret: (ts) => promote(ts[0]) },
  min: { usage: "min(a, b)", args: [2, 2], params: [num, num], ret: (ts) => commonType(ts[0], ts[1]) },
  max: { usage: "max(a, b)", args: [2, 2], params: [num, num], ret: (ts) => commonType(ts[0], ts[1]) },
  constrain: { usage: "constrain(x, low, high)", args: [3, 3], params: [num, num, num], ret: (ts) => commonType(commonType(ts[0], ts[1]), ts[2]) },
  sq: { usage: "sq(x)", args: [1, 1], params: [num], ret: (ts) => promote(ts[0]) },
  map: { usage: "map(value, fromLow, fromHigh, toLow, toHigh)", args: [5, 5], params: ["long", "long", "long", "long", "long"], ret: "long" },
  random: { usage: "random(max) or random(min, max)", args: [1, 2], params: ["long", "long"], ret: "long" },
  randomSeed: { usage: "randomSeed(seed)", args: [1, 1], params: ["ulong"], ret: "void" },
  sqrt: { usage: "sqrt(x)", args: [1, 1], params: ["float"], ret: "float" },
  pow: { usage: "pow(base, exponent)", args: [2, 2], params: ["float", "float"], ret: "float" },
  sin: { usage: "sin(radians)", args: [1, 1], params: ["float"], ret: "float" },
  cos: { usage: "cos(radians)", args: [1, 1], params: ["float"], ret: "float" },
  tan: { usage: "tan(radians)", args: [1, 1], params: ["float"], ret: "float" },
  floor: { usage: "floor(x)", args: [1, 1], params: ["float"], ret: "float" },
  ceil: { usage: "ceil(x)", args: [1, 1], params: ["float"], ret: "float" },
  round: { usage: "round(x)", args: [1, 1], params: ["float"], ret: "long" },
  String: { usage: "String(value)", args: [0, 2], params: ["any", "int"], ret: "String" },
  // F("text") keeps text in flash memory on a real Uno to save RAM - the
  // simulator has no RAM limit, so it just passes the text through.
  F: { usage: 'F("text")', args: [1, 1], params: ["any"], ret: "cstr" },
  "Serial.begin": { usage: "Serial.begin(baudRate)", args: [1, 2], params: ["ulong", "int"], ret: "void" },
  "Serial.print": { usage: "Serial.print(value)", args: [1, 2], params: ["any", "int"], ret: "uint" },
  "Serial.println": { usage: "Serial.println(value)", args: [0, 2], params: ["any", "int"], ret: "uint" },
  "Serial.write": { usage: "Serial.write(value)", args: [1, 1], params: ["any"], ret: "uint" },
  "Serial.flush": { usage: "Serial.flush()", args: [0, 0], params: [], ret: "void" },
};

// Methods of the supported library objects.
const METHODS = {
  Servo: {
    attach: { usage: "attach(pin)", args: [1, 3], params: ["int", "int", "int"], ret: "uint" },
    write: { usage: "write(angle)", args: [1, 1], params: ["int"], ret: "void" },
    writeMicroseconds: { usage: "writeMicroseconds(us)", args: [1, 1], params: ["int"], ret: "void" },
    read: { usage: "read()", args: [0, 0], params: [], ret: "int" },
    attached: { usage: "attached()", args: [0, 0], params: [], ret: "bool" },
    detach: { usage: "detach()", args: [0, 0], params: [], ret: "void" },
  },
  LiquidCrystal: {
    begin: { usage: "begin(columns, rows)", args: [2, 2], params: ["int", "int"], ret: "void" },
    print: { usage: "print(value)", args: [1, 2], params: ["any", "int"], ret: "uint" },
    write: { usage: "write(character)", args: [1, 1], params: ["any"], ret: "uint" },
    setCursor: { usage: "setCursor(column, row)", args: [2, 2], params: ["int", "int"], ret: "void" },
    clear: { usage: "clear()", args: [0, 0], params: [], ret: "void" },
    home: { usage: "home()", args: [0, 0], params: [], ret: "void" },
  },
  String: {
    length: { usage: "length()", args: [0, 0], params: [], ret: "uint" },
  },
};

// Real Arduino functions this simulator doesn't run, so using one gets an
// honest "not supported yet" instead of "was not declared".
const KNOWN_UNSUPPORTED = new Set([
  "attachInterrupt", "detachInterrupt", "interrupts", "noInterrupts", "shiftOut", "shiftIn",
  "bitRead", "bitWrite", "bitSet", "bitClear", "bit", "lowByte", "highByte", "analogReference",
  "analogReadResolution", "analogWriteResolution", "yield", "fmod", "log", "exp",
]);

// Spelling-mistake suggestions ("did you mean ledPin?").
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function suggest(name, candidates) {
  let best = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = editDistance(name, c);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  const limit = name.length <= 4 ? 1 : 2;
  return best !== null && bestDist <= limit ? best : null;
}

const describeType = (t) => (t.startsWith("unknown:") ? t.slice(8) : typeLabel(t));
// "an int", "a float", "text in quotes" - for readable messages.
const withArticle = (t) => {
  if (t === "cstr") return typeLabel(t);
  const label = describeType(t);
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
};

class Analyzer {
  constructor(program) {
    this.program = program;
    this.warnings = [];
    this.functions = new Map(); // name -> Function node (definitions only)
    this.globalScope = { vars: new Map(), parent: null };
    for (const [name, [type]] of Object.entries(BUILTIN_CONSTANTS)) {
      this.globalScope.vars.set(name, { name, type, isConst: true, builtin: true });
    }
    this.currentFn = null;
    this.loopDepth = 0;
  }

  error(message, line) { throw new SimError(message, line); }
  warn(message, line) { this.warnings.push(new SimError(message, line).message); }

  analyze() {
    const prototypes = new Map();
    // Arduino generates prototypes for every function automatically, so a
    // function can be called from code above where it's written - collect
    // them all first.
    for (const item of this.program.items) {
      if (item.type === "Function") {
        if (BUILTINS[item.name] || item.name === "Serial") {
          this.error(`'${item.name}' is already a built-in Arduino function - give your function a different name`, item.line);
        }
        if (this.functions.has(item.name)) {
          this.error(`The function '${item.name}' is defined twice (first on line ${this.functions.get(item.name).line}) - functions with the same name but different parameters (overloading) aren't supported`, item.line);
        }
        this.functions.set(item.name, item);
      } else if (item.type === "Prototype") {
        prototypes.set(item.name, item);
      }
    }
    for (const [name, proto] of prototypes) {
      const fn = this.functions.get(name);
      if (!fn) continue; // only an error if it's actually called (see call checking)
      const same = fn.returnType === proto.returnType && fn.params.length === proto.params.length &&
        fn.params.every((p, i) => p.type === proto.params[i].type);
      if (!same) this.error(`The declaration of '${name}' on line ${proto.line} doesn't match its definition on line ${fn.line}`, proto.line);
    }
    this.prototypes = prototypes;

    for (const name of ["setup", "loop"]) {
      const fn = this.functions.get(name);
      if (!fn) this.error("Every sketch needs both a setup() and a loop() function.");
      if (fn.returnType !== "void" || fn.params.length) this.error(`${name}() must be written exactly as void ${name}() { ... }`, fn.line);
    }

    // Globals are only visible to code written below them - real C++ rules
    // (it's functions, not variables, that Arduino lets you use early).
    for (const item of this.program.items) {
      if (item.type === "VarDecl") this.varDecl(item, this.globalScope, true);
      else if (item.type === "Function") this.functionBody(item);
    }
    return { functions: this.functions, warnings: this.warnings };
  }

  lookup(scope, name) {
    for (let s = scope; s; s = s.parent) {
      const sym = s.vars.get(name);
      if (sym) return sym;
    }
    return null;
  }

  namesInScope(scope) {
    const names = new Set([...this.functions.keys(), ...Object.keys(BUILTINS).filter((n) => !n.includes("."))]);
    for (let s = scope; s; s = s.parent) for (const n of s.vars.keys()) names.add(n);
    return names;
  }

  declare(scope, name, sym, line) {
    const existing = scope.vars.get(name);
    if (existing) {
      if (existing.builtin) this.error(`'${name}' is a built-in Arduino constant - pick a different name`, line);
      this.error(`'${name}' is already declared here (on line ${existing.line}) - each name can only be declared once in the same block`, line);
    }
    scope.vars.set(name, sym);
  }

  checkTypeExists(type, line) {
    if (type.startsWith("unknown:")) {
      this.error(`Unknown type '${type.slice(8)}' - this simulator supports the standard types (int, long, float, bool, char, byte, String ...) and the Servo and LiquidCrystal libraries`, line);
    }
  }

  // Can a value of type `from` be stored in something of type `to`?
  checkAssignable(from, to, what, line) {
    if (from === "void") this.error(`${what}: that function doesn't return a value (it's void), so there's nothing to use`, line);
    if (isNumericType(to)) {
      if (isNumericType(from)) return;
      if (isTextType(from)) this.error(`${what}: text can't be stored in ${withArticle(to)} - use a String variable for text`, line);
      this.error(`${what}: ${withArticle(from)} can't be stored in ${withArticle(to)}`, line);
    }
    if (to === "String") {
      if (isNumericType(from) || isTextType(from)) return;
      this.error(`${what}: ${withArticle(from)} can't be turned into a String`, line);
    }
    if (from !== to) this.error(`${what}: expected ${withArticle(to)} but got ${withArticle(from)}`, line);
  }

  varDecl(decl, scope, isGlobal) {
    this.checkTypeExists(decl.varType, decl.line);
    if (decl.varType === "void") this.error("A variable can't have type void", decl.line);
    for (const d of decl.declarators) {
      if (decl.isConst && !d.init && !isObjectType(decl.varType)) {
        this.error(`The const '${d.name}' must be given its value where it's declared, like const int ${d.name} = 5;`, d.line);
      }
      if (d.init) this.checkAssignable(this.expr(d.init, scope), decl.varType, `Starting value of '${d.name}'`, d.line);
      if (d.ctorArgs) for (const a of d.ctorArgs) this.expr(a, scope);
      this.declare(scope, d.name, {
        name: d.name, type: decl.varType, isConst: decl.isConst, line: d.line,
        storage: isGlobal ? "global" : decl.isStatic ? "static" : "local",
      }, d.line);
    }
  }

  functionBody(fn) {
    this.checkTypeExists(fn.returnType, fn.line);
    const scope = { vars: new Map(), parent: this.globalScope };
    for (const p of fn.params) {
      this.checkTypeExists(p.type, p.line);
      if (p.type === "void") this.error(`Parameter '${p.name}' can't have type void`, p.line);
      this.declare(scope, p.name, { name: p.name, type: p.type, isConst: false, line: p.line, storage: "local" }, p.line);
    }
    this.currentFn = fn;
    // The function's own { } shares the parameters' scope, like C++.
    for (const stmt of fn.body.stmts) this.stmt(stmt, scope);
    if (fn.returnType !== "void" && !this.alwaysReturns(fn.body)) {
      this.warn(`'${fn.name}' can reach its end without returning a value - on a real board the result would be garbage. Add a return statement.`, fn.endLine ?? fn.line);
    }
    this.currentFn = null;
  }

  alwaysReturns(stmt) {
    if (!stmt) return false;
    switch (stmt.type) {
      case "Return": return true;
      case "Block": return stmt.stmts.some((s) => this.alwaysReturns(s));
      case "If": return !!stmt.else && this.alwaysReturns(stmt.then) && this.alwaysReturns(stmt.else);
      case "While": return stmt.cond.type === "Literal" && truthy(stmt.cond.value) && !this.containsBreak(stmt.body);
      case "For": return !stmt.cond && !this.containsBreak(stmt.body);
      default: return false;
    }
  }

  containsBreak(stmt) {
    if (!stmt) return false;
    if (stmt.type === "Break") return true;
    if (stmt.type === "Block") return stmt.stmts.some((s) => this.containsBreak(s));
    if (stmt.type === "If") return this.containsBreak(stmt.then) || this.containsBreak(stmt.else);
    return false; // a break inside a nested loop belongs to that loop
  }

  condition(node, scope, what) {
    const t = this.expr(node, scope);
    if (!isNumericType(t)) this.error(`The condition of ${what} has to be a number or true/false, not ${withArticle(t)}`, node.line);
    if (node.type === "Assign" && node.op === "=" && !node.parens) {
      this.warn(`The condition of ${what} uses '=', which STORES a value instead of comparing - did you mean '=='?`, node.line);
    }
  }

  stmt(stmt, scope) {
    switch (stmt.type) {
      case "Block": {
        const inner = { vars: new Map(), parent: scope };
        for (const s of stmt.stmts) this.stmt(s, inner);
        return;
      }
      case "Empty": return;
      case "VarDecl": return this.varDecl(stmt, scope, false);
      case "ExprStmt": {
        this.expr(stmt.expr, scope);
        const e = stmt.expr;
        if (e.type === "Binary" && ["==", "!=", "<", "<=", ">", ">="].includes(e.op)) {
          this.warn(`This line compares two values but does nothing with the answer - did you mean '=' to store a value?`, stmt.line);
        }
        return;
      }
      case "If":
        this.condition(stmt.cond, scope, "this if");
        if (stmt.then.type === "Empty") {
          this.warn("There's a ';' right after if (...) - that ends the if, so the line after it ALWAYS runs. Remove the ';'.", stmt.line);
        }
        this.stmt(stmt.then, scope);
        if (stmt.else) this.stmt(stmt.else, scope);
        return;
      case "While":
        this.condition(stmt.cond, scope, "this while loop");
        this.loopBody(stmt.body, scope);
        return;
      case "For": {
        const inner = { vars: new Map(), parent: scope };
        if (stmt.init) this.stmt(stmt.init, inner);
        if (stmt.cond) this.condition(stmt.cond, inner, "this for loop");
        if (stmt.update) this.expr(stmt.update, inner);
        this.loopBody(stmt.body, inner);
        return;
      }
      case "Break":
      case "Continue":
        if (this.loopDepth === 0) this.error(`'${stmt.type.toLowerCase()}' can only be used inside a loop (for or while)`, stmt.line);
        return;
      case "Return": {
        const fn = this.currentFn;
        if (fn.returnType === "void") {
          if (stmt.expr) this.error(`${fn.name}() is a void function, so 'return' can't send back a value - use plain 'return;'`, stmt.line);
        } else {
          if (!stmt.expr) this.error(`${fn.name}() has to return ${withArticle(fn.returnType)} - write return followed by a value`, stmt.line);
          this.checkAssignable(this.expr(stmt.expr, scope), fn.returnType, `Return value of ${fn.name}()`, stmt.line);
        }
        stmt.returnType = fn.returnType;
        return;
      }
      default:
        this.error(`Cannot check statement of type ${stmt.type}`, stmt.line);
    }
  }

  loopBody(body, scope) {
    this.loopDepth++;
    this.stmt(body, scope);
    this.loopDepth--;
  }

  // Works out (and records on the node as .ctype) the type of an expression.
  expr(node, scope) {
    const t = this.exprType(node, scope);
    node.ctype = t;
    return t;
  }

  assignableTarget(target, scope, line, verb) {
    if (target.type !== "Ident") {
      this.error(`The left side of ${verb} has to be a variable`, line);
    }
    const sym = this.lookup(scope, target.name);
    if (!sym) this.undeclared(target.name, scope, target.line);
    if (sym.builtin) this.error(`${target.name} is a built-in Arduino constant, so it can't be changed`, line);
    if (sym.isConst) {
      this.error(`'${target.name}' is a const (declared on line ${sym.line}), so it can't be changed after it's declared. Remove this change, or drop 'const' if the value really needs to change.`, line);
    }
    if (isObjectType(sym.type)) this.error(`'${target.name}' is a ${sym.type} object and can't be assigned to`, line);
    target.ctype = sym.type;
    return sym;
  }

  undeclared(name, scope, line) {
    const hint = suggest(name, this.namesInScope(scope));
    this.error(`'${name}' was not declared - did you spell it correctly, or forget to declare it?${hint ? ` (Did you mean '${hint}'?)` : ""}`, line);
  }

  exprType(node, scope) {
    switch (node.type) {
      case "Literal": return node.ctype;

      case "Ident": {
        const sym = this.lookup(scope, node.name);
        if (sym) return sym.type;
        if (this.functions.has(node.name) || BUILTINS[node.name]) {
          this.error(`'${node.name}' is a function - call it with parentheses, like ${node.name}()`, node.line);
        }
        if (node.name === "Serial") this.error("Serial on its own isn't a value - use Serial.print(...) or Serial.println(...)", node.line);
        return this.undeclared(node.name, scope, node.line);
      }

      case "Member":
        this.error(`'${node.object.name}.${node.property}' needs parentheses - it's a function call`, node.line);
        break;

      case "Assign": {
        const sym = this.assignableTarget(node.target, scope, node.line, `'${node.op}'`);
        const vt = this.expr(node.value, scope);
        const t = sym.type;
        if (node.op === "=") {
          this.checkAssignable(vt, t, `Storing into '${sym.name}'`, node.line);
        } else if (t === "String") {
          if (node.op !== "+=") this.error(`Only += works on a String (to add text to the end)`, node.line);
          this.checkAssignable(vt, "String", `Adding to '${sym.name}'`, node.line);
        } else {
          const op = node.op.slice(0, -1);
          if (!isNumericType(vt)) this.error(`'${node.op}' needs a number on the right, not ${describeType(vt)}`, node.line);
          if (["%", "&", "|", "^", "<<", ">>"].includes(op) && (t === "float" || vt === "float")) {
            this.error(`'${node.op}' only works with whole numbers, not float`, node.line);
          }
        }
        return t;
      }

      case "Update": {
        const sym = this.assignableTarget(node.target, scope, node.line, `'${node.op}'`);
        if (!isNumericType(sym.type) || sym.type === "bool") {
          this.error(`'${node.op}' only works on a number variable, not ${withArticle(sym.type)}`, node.line);
        }
        return sym.type;
      }

      case "Unary": {
        const t = this.expr(node.expr, scope);
        if (!isNumericType(t)) this.error(`'${node.op}' can't be used on ${describeType(t)}`, node.line);
        if (node.op === "!") return "bool";
        if (node.op === "~" && t === "float") this.error("'~' only works with whole numbers", node.line);
        return t === "float" ? "float" : promote(t);
      }

      case "Cast": {
        const t = this.expr(node.expr, scope);
        if (!isNumericType(node.toType)) this.error(`Can't convert to ${describeType(node.toType)} this way`, node.line);
        if (!isNumericType(t)) this.error(`Can't convert ${describeType(t)} to a number this way`, node.line);
        return node.toType;
      }

      case "Ternary": {
        const ct = this.expr(node.cond, scope);
        if (!isNumericType(ct)) this.error(`The condition before '?' has to be a number or true/false`, node.line);
        const a = this.expr(node.then, scope);
        const b = this.expr(node.else, scope);
        if (isNumericType(a) && isNumericType(b)) return a === b ? a : commonType(a, b);
        if (isTextType(a) && isTextType(b)) return a === "String" || b === "String" ? "String" : "cstr";
        return this.error(`Both sides of ':' have to be the same kind of value (got ${describeType(a)} and ${describeType(b)})`, node.line);
      }

      case "Binary": return this.binaryType(node, scope);
      case "Call": return this.callType(node, scope);
      default:
        return this.error(`Cannot check expression of type ${node.type}`, node.line);
    }
  }

  binaryType(node, scope) {
    const lt = this.expr(node.left, scope);
    const rt = this.expr(node.right, scope);
    const op = node.op;
    for (const t of [lt, rt]) {
      if (t === "void") this.error("That function doesn't return a value (it's void), so it can't be used in a calculation", node.line);
      if (isObjectType(t)) this.error(`A ${t} object can't be used with '${op}'`, node.line);
    }

    if (op === "&&" || op === "||") {
      if (!isNumericType(lt) || !isNumericType(rt)) this.error(`'${op}' needs true/false values on both sides`, node.line);
      return "bool";
    }

    if (op === "+" && (isTextType(lt) || isTextType(rt))) {
      if (lt === "String" || rt === "String") {
        const other = lt === "String" ? rt : lt;
        if (!isNumericType(other) && !isTextType(other)) this.error(`Can't add ${withArticle(other)} to a String`, node.line);
        return "String";
      }
      if (isTextType(lt) && isTextType(rt)) {
        this.error(`Two pieces of text in quotes can't be joined with + in C++ - write String("...") + "..." instead`, node.line);
      }
      this.error(
        `Adding a number to text in quotes doesn't join them in C++ - it moves along the text in memory, so a real Uno would print garbage. Print the pieces one after another, or use String("...") + value.`,
        node.line
      );
    }

    if (["==", "!=", "<", "<=", ">", ">="].includes(op)) {
      if (isNumericType(lt) && isNumericType(rt)) return "bool";
      if (isTextType(lt) && isTextType(rt)) {
        if (lt === "cstr" && rt === "cstr") this.error("Comparing two pieces of text in quotes doesn't compare their letters in C++ - put one of them in a String first", node.line);
        return "bool";
      }
      return this.error(`Can't compare ${describeType(lt)} with ${describeType(rt)}`, node.line);
    }

    if (!isNumericType(lt) || !isNumericType(rt)) {
      return this.error(`'${op}' only works with numbers (got ${describeType(lt)} and ${describeType(rt)})`, node.line);
    }
    if (["%", "&", "|", "^", "<<", ">>"].includes(op)) {
      if (lt === "float" || rt === "float") this.error(`'${op}' only works with whole numbers, not float`, node.line);
      return op === "<<" || op === ">>" ? promote(lt) : commonType(lt, rt);
    }
    return commonType(lt, rt);
  }

  checkArgs(sig, name, node, scope, argTypes) {
    const [min, max] = sig.args;
    const n = node.args.length;
    if (n < min || n > max) {
      const want = min === max ? `${min} argument${min === 1 ? "" : "s"}` : `${min} to ${max} arguments`;
      this.error(`${name}() needs ${want} - ${sig.usage} - but was given ${n}`, node.line);
    }
    argTypes.forEach((t, i) => {
      const p = sig.params[i] ?? "any";
      if (t === "void") this.error(`Argument ${i + 1} of ${name}() comes from a function that doesn't return a value`, node.line);
      if (p === "any") {
        if (isObjectType(t)) this.error(`A ${t} object can't be passed to ${name}()`, node.line);
      } else if (!isNumericType(t)) {
        this.error(`${name}() expects a number for argument ${i + 1} (${sig.usage}), not ${describeType(t)}`, node.line);
      }
    });
  }

  callType(node, scope) {
    const callee = node.callee;
    // Name an unsupported Arduino function before looking at its arguments,
    // which often use things that don't exist here either (RISING, ...).
    if (callee.type === "Ident" && KNOWN_UNSUPPORTED.has(callee.name) && !this.functions.has(callee.name)) {
      this.error(`${callee.name}() isn't supported in this simulator yet`, node.line);
    }
    const argTypes = node.args.map((a) => this.expr(a, scope));

    if (callee.type === "Member") {
      const objName = callee.object.name;
      const sym = this.lookup(scope, objName);
      if (!sym && objName === "Serial") {
        const name = `Serial.${callee.property}`;
        const sig = BUILTINS[name];
        if (!sig) {
          if (["available", "read", "peek", "parseInt", "parseFloat", "readString", "readStringUntil", "readBytes"].includes(callee.property)) {
            this.error(`Reading from the Serial Monitor (${name}) isn't supported in this simulator yet - it can only send output`, node.line);
          }
          this.error(`'${name}' isn't supported in this simulator`, node.line);
        }
        this.checkArgs(sig, name, node, scope, argTypes);
        node.callKind = "builtin";
        node.builtin = name;
        return sig.ret;
      }
      if (!sym) this.undeclared(objName, scope, callee.object.line);
      const methods = METHODS[sym.type];
      if (!methods) this.error(`'${objName}' is ${withArticle(sym.type)}, which has no functions to call with '.'`, node.line);
      const sig = methods[callee.property];
      if (!sig) {
        this.error(`${sym.type} has no function '${callee.property}' in this simulator (supported: ${Object.keys(methods).join(", ")})`, node.line);
      }
      this.checkArgs(sig, `${objName}.${callee.property}`, node, scope, argTypes);
      node.callKind = "method";
      node.objectType = sym.type;
      return sig.ret;
    }

    if (callee.type !== "Ident") this.error("Unsupported function call", node.line);
    const name = callee.name;
    const shadow = this.lookup(scope, name);
    if (shadow && !shadow.builtin) this.error(`'${name}' is a variable (declared on line ${shadow.line}), not a function`, node.line);

    const fn = this.functions.get(name);
    if (fn) {
      if (node.args.length !== fn.params.length) {
        const list = fn.params.map((p) => p.name).join(", ");
        this.error(`${name}() needs ${fn.params.length} argument${fn.params.length === 1 ? "" : "s"}${list ? ` (${list})` : ""} but was given ${node.args.length}`, node.line);
      }
      fn.params.forEach((p, i) => this.checkAssignable(argTypes[i], p.type, `Argument '${p.name}' of ${name}()`, node.line));
      node.callKind = "user";
      node.fn = fn;
      return fn.returnType;
    }
    if (this.prototypes?.has(name)) {
      this.error(`'${name}' is declared (on line ${this.prototypes.get(name).line}) but never defined - write its body with { ... }`, node.line);
    }
    const sig = BUILTINS[name];
    if (sig && !name.includes(".")) {
      this.checkArgs(sig, name, node, scope, argTypes);
      if (name === "F" && argTypes[0] !== "cstr") this.error('F() only takes text in quotes, like F("Hello")', node.line);
      node.callKind = "builtin";
      node.builtin = name;
      return typeof sig.ret === "function" ? sig.ret(argTypes) : sig.ret;
    }
    if (KNOWN_UNSUPPORTED.has(name)) this.error(`${name}() isn't supported in this simulator yet`, node.line);
    const hint = suggest(name, this.namesInScope(scope));
    return this.error(`'${name}' was not declared - is it spelled correctly, or is the function missing?${hint ? ` (Did you mean '${hint}'?)` : ""}`, node.line);
  }
}

// Parses AND checks a sketch without running it. Throws a SimError for the
// first problem; returns { program, warnings } when the sketch is valid.
export function compile(source) {
  let program;
  try {
    program = parse(source);
  } catch (e) {
    if (e instanceof SimError) e.phase = "syntax";
    throw e;
  }
  try {
    const { functions, warnings } = new Analyzer(program).analyze();
    return { program, functions, warnings };
  } catch (e) {
    if (e instanceof SimError) e.phase = "check";
    throw e;
  }
}

// What kind of mistake an error is - so the learner can tell "I mistyped
// something" from "this simulator can't run that" from "it broke while
// running":
//   syntax      - the code doesn't follow C++'s grammar (a missing ; or })
//   unsupported - possibly valid Arduino code the simulator can't run
//   code        - grammatical, but doesn't make sense (unknown name, wrong type, const changed...)
//   runtime     - the sketch started, then hit something impossible (dividing by zero)
// Wiring problems never come from here - they come from the circuit check
// (board.inspectCircuit), which reads the actual board.
const UNSUPPORTED_PATTERN = /\b(isn't|aren't|is not) supported\b|\bnot supported\b/i;

export function classifyError(e) {
  const message = e instanceof SimError ? e.message : `Internal simulator error: ${e?.message ?? e}`;
  const line = e instanceof SimError && e.line ? e.line : null;
  let kind;
  if (!(e instanceof SimError)) kind = "internal";
  else if (UNSUPPORTED_PATTERN.test(message)) kind = "unsupported";
  else if (e.phase === "syntax") kind = "syntax";
  else if (e.phase === "check") kind = "code";
  else kind = "runtime";
  return { kind, line, message };
}

// ================================================================= evaluator
// A generator-based tree walker. `yield`ing a { type: "delay", ms } object is
// how delay() pauses without blocking the browser - see startProgram() below
// for the scheduler that resumes it.

const TICK = { type: "tick" };
const MAX_CALL_DEPTH = 64; // generous for a 2 KB-RAM Uno; mostly catches runaway recursion

class BreakSignal {}
class ContinueSignal {}
class ReturnSignal {
  constructor(value) { this.value = value; }
}

class Scope {
  constructor(parent) {
    this.parent = parent;
    this.vars = new Map(); // name -> { value, type }
  }
  lookup(name) {
    for (let s = this; s; s = s.parent) {
      const b = s.vars.get(name);
      if (b) return b;
    }
    throw new SimError(`'${name}' was not declared`); // can't happen after analyze()
  }
}

// Shared by EVERY place a variable can be declared without a starting value
// (globals, locals, statics). Keeping this in one function is deliberate:
// those code paths drifting apart is exactly how a bug shipped here once
// already (a global `Servo myServo;` silently became 0 instead of a servo).
function defaultValueForType(type) {
  if (type === "Servo") return { __kind: "Servo", pin: null, angle: 90 };
  if (type === "LiquidCrystal") return { __kind: "LiquidCrystal" };
  if (type === "String") return "";
  if (type === "bool") return false;
  return 0;
}

// A small seedable random number generator (mulberry32), so randomSeed(42)
// gives the same sequence every run - just like on a real board.
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const describeLevel = (v) => (v ? "HIGH" : "LOW");

class Interpreter {
  // hw: the board API (pinMode, digitalWrite, ...); host: { millisNow, print, warn }
  constructor(program, functions, hw, host) {
    this.program = program;
    this.functions = functions;
    this.hw = hw;
    this.host = host;
    this.globals = new Scope(null);
    for (const [name, [type, value]] of Object.entries(BUILTIN_CONSTANTS)) this.globals.vars.set(name, { value, type });
    this.callDepth = 0;
    this.pinModes = new Map(); // pin -> mode number, as THIS sketch has set it (for warnings)
    this.serialStarted = false;
    this.warned = new Set();
    this.random = makeRandom(Math.floor(Math.random() * 4294967296));
  }

  warnOnce(key, message, line) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.host.warn(new SimError(message, line).message);
  }

  *run() {
    for (const item of this.program.items) {
      if (item.type === "VarDecl") yield* this.execVarDecl(item, this.globals);
    }
    yield* this.callFunction(this.functions.get("setup"), [], 0);
    const loop = this.functions.get("loop");
    for (;;) {
      yield* this.callFunction(loop, [], 0);
      yield TICK;
    }
  }

  // Calls a user function. Arguments arrive already converted to the
  // parameter types. A `return` anywhere inside - however deeply nested in
  // ifs and loops - unwinds straight back to here as a ReturnSignal, which
  // is what makes it leave the function immediately, and only that function.
  *callFunction(fn, args, line) {
    if (this.callDepth >= MAX_CALL_DEPTH) {
      throw new SimError(
        `Too many functions calling each other (more than ${MAX_CALL_DEPTH} deep) - most likely a function that keeps calling itself. A real Uno only has 2 KB of memory for this and would crash.`,
        line
      );
    }
    this.callDepth++;
    try {
      const scope = new Scope(this.globals);
      fn.params.forEach((p, i) => scope.vars.set(p.name, { value: args[i], type: p.type }));
      for (const stmt of fn.body.stmts) yield* this.execStmt(stmt, scope);
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    } finally {
      this.callDepth--;
    }
    return fn.returnType === "void" ? undefined : defaultValueForType(fn.returnType);
  }

  // Converts a value for storing into a variable/parameter of type `to`,
  // warning (once per line) when a whole number doesn't fit and wraps.
  store(value, from, to, line) {
    const stored = convert(value, from, to);
    if (to in INT_TYPES && isNumericType(from) && from !== "bool") {
      const n = from === "float" ? Math.trunc(value) : Number(value);
      if (Number.isFinite(n) && !fitsIn(n, to)) {
        const info = INT_TYPES[to];
        this.warnOnce(
          `narrow:${line}:${to}`,
          `${from === "float" ? formatValue(value, "float") : n} doesn't fit in ${withArticle(to)} (${info.min} to ${info.max} on an Uno), so it was stored as ${stored}.`,
          line
        );
      }
    }
    return stored;
  }

  *execVarDecl(decl, scope) {
    for (const d of decl.declarators) {
      if (decl.isStatic && scope !== this.globals) {
        // A static local keeps its value between calls: one binding per
        // declaration, created (and initialized) only the first time.
        if (!d.staticCell) {
          const cell = { value: defaultValueForType(decl.varType), type: decl.varType };
          d.staticCell = cell;
          if (d.init) cell.value = this.store(yield* this.evalExpr(d.init, scope), d.init.ctype, decl.varType, d.line);
        }
        scope.vars.set(d.name, d.staticCell);
        continue;
      }
      if (d.ctorArgs) for (const a of d.ctorArgs) yield* this.evalExpr(a, scope);
      const value = d.init
        ? this.store(yield* this.evalExpr(d.init, scope), d.init.ctype, decl.varType, d.line)
        : defaultValueForType(decl.varType);
      scope.vars.set(d.name, { value, type: decl.varType });
    }
  }

  *execBlock(block, scope) {
    const local = new Scope(scope);
    for (const stmt of block.stmts) yield* this.execStmt(stmt, local);
  }

  *execStmt(stmt, scope) {
    yield TICK;
    switch (stmt.type) {
      case "Block": return yield* this.execBlock(stmt, scope);
      case "Empty": return;
      case "VarDecl": return yield* this.execVarDecl(stmt, scope);
      case "ExprStmt":
        yield* this.evalExpr(stmt.expr, scope);
        return;
      case "If": {
        if (truthy(yield* this.evalExpr(stmt.cond, scope))) yield* this.execStmt(stmt.then, scope);
        else if (stmt.else) yield* this.execStmt(stmt.else, scope);
        return;
      }
      case "While": {
        while (truthy(yield* this.evalExpr(stmt.cond, scope))) {
          try {
            yield* this.execStmt(stmt.body, scope);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (!(e instanceof ContinueSignal)) throw e;
          }
        }
        return;
      }
      case "For": {
        const local = new Scope(scope);
        if (stmt.init) yield* this.execStmt(stmt.init, local);
        while (stmt.cond ? truthy(yield* this.evalExpr(stmt.cond, local)) : true) {
          try {
            yield* this.execStmt(stmt.body, local);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (!(e instanceof ContinueSignal)) throw e;
          }
          if (stmt.update) yield* this.evalExpr(stmt.update, local);
          yield TICK;
        }
        return;
      }
      case "Break": throw new BreakSignal();
      case "Continue": throw new ContinueSignal();
      case "Return": {
        const value = stmt.expr
          ? this.store(yield* this.evalExpr(stmt.expr, scope), stmt.expr.ctype, stmt.returnType, stmt.line)
          : undefined;
        throw new ReturnSignal(value);
      }
      default:
        throw new SimError(`Cannot execute statement of type ${stmt.type}`, stmt.line);
    }
  }

  // + - * / % & | ^ << >> on numbers, with the Uno's integer rules, a
  // friendly error for division by zero, and a warning when a signed whole
  // number overflows (wraps around).
  arithmetic(op, l, lt, r, rt, line) {
    let result;
    try {
      result = arith(op, l, lt, r, rt);
    } catch (e) {
      if (e.divideByZero) {
        throw new SimError(
          `Division by zero (${op === "%" ? "remainder" : "dividing"} by 0). A real Uno wouldn't stop here - it would carry on with a garbage number - so the simulator stops the sketch to point it out.`,
          line
        );
      }
      throw e;
    }
    if (result.exact !== undefined) {
      const info = INT_TYPES[result.type];
      this.warnOnce(
        `overflow:${line}`,
        `${formatValue(l, lt)} ${op} ${formatValue(r, rt)} = ${result.exact}, which doesn't fit in ${withArticle(result.type)} (${info.min} to ${info.max} on an Uno), so it wrapped around to ${result.value}. Use long (or unsigned long) for bigger numbers.`,
        line
      );
    }
    return result;
  }

  *evalExpr(node, scope) {
    switch (node.type) {
      case "Literal": return node.value;
      case "Ident": return scope.lookup(node.name).value;

      case "Assign": {
        const binding = scope.lookup(node.target.name);
        let value = yield* this.evalExpr(node.value, scope);
        let vt = node.value.ctype;
        if (node.op !== "=") {
          if (binding.type === "String") {
            value = binding.value + formatValue(value, vt);
            vt = "String";
          } else {
            const r = this.arithmetic(node.op.slice(0, -1), binding.value, binding.type, value, vt, node.line);
            value = r.value;
            vt = r.type;
          }
        }
        binding.value = this.store(value, vt, binding.type, node.line);
        return binding.value;
      }

      case "Update": {
        const binding = scope.lookup(node.target.name);
        const oldValue = binding.value;
        const r = this.arithmetic(node.op === "++" ? "+" : "-", oldValue, binding.type, 1, "int", node.line);
        binding.value = this.store(r.value, r.type, binding.type, node.line);
        return node.prefix ? binding.value : oldValue;
      }

      case "Unary": {
        const v = yield* this.evalExpr(node.expr, scope);
        const t = node.expr.ctype;
        if (node.op === "!") return !truthy(v);
        if (node.op === "+") return convert(v, t, node.ctype);
        if (node.op === "-") {
          if (node.ctype === "float") return Math.fround(-v);
          return this.arithmetic("-", 0, "int", v, t, node.line).value;
        }
        return convert(~convert(v, t, node.ctype), "long", node.ctype); // ~
      }

      case "Cast": return convert(yield* this.evalExpr(node.expr, scope), node.expr.ctype, node.toType);

      case "Ternary": {
        const branch = truthy(yield* this.evalExpr(node.cond, scope)) ? node.then : node.else;
        const v = yield* this.evalExpr(branch, scope);
        return node.ctype === "String" && branch.ctype !== "String" ? formatValue(v, branch.ctype) : convert(v, branch.ctype, node.ctype);
      }

      case "Binary": {
        const op = node.op;
        if (op === "&&") {
          if (!truthy(yield* this.evalExpr(node.left, scope))) return false;
          return truthy(yield* this.evalExpr(node.right, scope));
        }
        if (op === "||") {
          if (truthy(yield* this.evalExpr(node.left, scope))) return true;
          return truthy(yield* this.evalExpr(node.right, scope));
        }
        const l = yield* this.evalExpr(node.left, scope);
        const r = yield* this.evalExpr(node.right, scope);
        const lt = node.left.ctype;
        const rt = node.right.ctype;
        if (["==", "!=", "<", "<=", ">", ">="].includes(op)) return compare(op, l, lt, r, rt);
        if (node.ctype === "String") return formatValue(l, lt) + formatValue(r, rt);
        return this.arithmetic(op, l, lt, r, rt, node.line).value;
      }

      case "Call": {
        const args = [];
        for (const a of node.args) args.push(yield* this.evalExpr(a, scope));
        const types = node.args.map((a) => a.ctype);
        if (node.callKind === "user") {
          const fn = node.fn;
          const converted = fn.params.map((p, i) => this.store(args[i], types[i], p.type, node.line));
          return yield* this.callFunction(fn, converted, node.line);
        }
        if (node.callKind === "method") {
          const obj = scope.lookup(node.callee.object.name);
          return this.callMethod(obj, node, args, types);
        }
        return yield* this.callBuiltin(node.builtin, args, types, node);
      }

      default:
        throw new SimError(`Cannot evaluate expression of type ${node.type}`, node.line);
    }
  }

  // ---------------------------------------------------------------- hardware

  checkPin(fnName, pin, line) {
    if (isValidPin(pin)) return true;
    this.warnOnce(
      `badpin:${fnName}:${pin}:${line}`,
      `${fnName}(${pin}, ...): an Arduino Uno has no pin ${pin} - the digital pins are 0-13 and A0-A5 are 14-19. This call was ignored.`,
      line
    );
    return false;
  }

  checkSerialPin(pin, line) {
    if (this.serialStarted && (pin === 0 || pin === 1)) {
      this.warnOnce(
        `serialpin:${pin}`,
        `Pin ${pin} is the Uno's Serial ${pin === 0 ? "RX (receive)" : "TX (transmit)"} line, which Serial uses to talk to the Serial Monitor. Using it for anything else while Serial is running garbles both - pick another pin.`,
        line
      );
    }
  }

  printText(value, type, fmtArg, fnName, line) {
    if (!this.serialStarted) {
      this.warnOnce(
        "serial-not-started",
        `${fnName}() was used before Serial.begin() - on a real Uno nothing would show up in the Serial Monitor. Add Serial.begin(9600); to setup(). (The simulator shows the output anyway.)`,
        line
      );
    }
    return value === undefined ? "" : formatValue(value, type, fmtArg);
  }

  *callBuiltin(name, rawArgs, types, node) {
    const line = node.line;
    const sig = BUILTINS[name];
    // Convert each argument to the parameter's type, like a real call does.
    // (The cases below explain any value that doesn't make sense themselves -
    // e.g. a negative delay() - so no generic "doesn't fit" warning here.)
    const args = rawArgs.map((v, i) => {
      const p = sig.params[i];
      return p && p !== "any" && p !== num ? convert(v, types[i], p) : v;
    });
    const hw = this.hw;

    switch (name) {
      case "pinMode": {
        const [pin, mode] = args;
        if (!this.checkPin(name, pin, line)) return;
        if (!(mode in MODE_NAMES)) {
          this.warnOnce(`badmode:${line}`, `pinMode(${pin}, ${mode}): the mode has to be INPUT, OUTPUT or INPUT_PULLUP. This call was ignored.`, line);
          return;
        }
        this.checkSerialPin(pin, line);
        this.pinModes.set(pin, mode);
        hw.pinMode(pin, MODE_NAMES[mode]);
        return;
      }

      case "digitalWrite": {
        const [pin, value] = args;
        if (!this.checkPin(name, pin, line)) return;
        const level = value === 0 ? 0 : 1; // like the Arduino core, anything other than LOW counts as HIGH
        const mode = this.pinModes.get(pin);
        if (mode !== MODE_OUTPUT) {
          const p = pinName(pin);
          const explain = "Writing to an input pin doesn't drive it on a real Uno: HIGH only switches on the pin's weak internal pull-up resistor (an LED would barely glow - the simulator shows it as off) and LOW switches that off.";
          this.warnOnce(
            `write-input:${pin}`,
            mode === undefined
              ? `digitalWrite(${p}, ${describeLevel(level)}): pin ${p} was never set up with pinMode(${p}, OUTPUT), so it's still an INPUT. ${explain} Add pinMode(${p}, OUTPUT); to setup().`
              : `digitalWrite(${p}, ${describeLevel(level)}): pin ${p} is set to ${MODE_NAMES[mode]}, not OUTPUT. ${explain} To drive an LED use pinMode(${p}, OUTPUT); to turn the pull-up on, pinMode(${p}, INPUT_PULLUP) says it more clearly.`,
            line
          );
        }
        this.checkSerialPin(pin, line);
        hw.digitalWrite(pin, level);
        return;
      }

      case "digitalRead": {
        const [pin] = args;
        if (!this.checkPin(name, pin, line)) return 0;
        const value = hw.digitalRead(pin) ? 1 : 0;
        const status = hw.pinStatus?.(pin);
        if (status?.floating) {
          this.warnOnce(
            `floating:${pin}`,
            `digitalRead(${pinName(pin)}): nothing is pulling pin ${pinName(pin)} HIGH or LOW right now - it's "floating" - so a real Uno reads random values, and so does the simulator. Use pinMode(${pinName(pin)}, INPUT_PULLUP), or add a pull-down resistor from pin ${pinName(pin)} to GND.`,
            line
          );
        }
        return value;
      }

      case "analogRead": {
        let [pin] = args;
        if (pin >= 0 && pin <= 5) pin += 14; // analogRead(0) means A0 on an Uno
        if (!isAnalogPin(pin)) {
          this.warnOnce(`analogread-pin:${pin}:${line}`, `analogRead(${args[0]}): only A0-A5 can read analog values on an Uno. This read returned 0.`, line);
          return 0;
        }
        return hw.analogRead ? wrapResult(hw.analogRead(pin)) : 0;
      }

      case "analogWrite": {
        const [pin, value] = args;
        if (!this.checkPin(name, pin, line)) return;
        if (!PWM_PINS.has(pin)) {
          this.warnOnce(
            `pwm:${pin}`,
            `analogWrite(${pinName(pin)}, ...): pin ${pinName(pin)} can't do PWM on an Arduino Uno - only pins 3, 5, 6, 9, 10 and 11 can (marked ~ on the board). A real Uno turns this pin fully ON for values of 128 or more and fully OFF below 128 instead of dimming it, and so does the simulator.`,
            line
          );
        } else if (value < 0 || value > 255) {
          this.warnOnce(
            `pwm-range:${line}`,
            `analogWrite(${pinName(pin)}, ${value}): the value has to be between 0 and 255. A real Uno only keeps the lowest 8 bits, so ${value} comes out as ${value & 0xff}. Use constrain() or map() to keep it in range.`,
            line
          );
        }
        this.pinModes.set(pin, MODE_OUTPUT); // analogWrite() makes the pin an output, like the real core
        this.checkSerialPin(pin, line);
        hw.analogWrite?.(pin, value);
        return;
      }

      case "delay": {
        const ms = args[0];
        if (rawArgs[0] < 0) {
          this.warnOnce(
            `negative-delay:${line}`,
            `delay(${rawArgs[0]}): delay() can't wait a negative amount of time - the number is turned into an unsigned long, so a real Uno would wait ${ms} ms (about ${Math.round(ms / 86400000)} days). Click Stop to end it.`,
            line
          );
        }
        yield { type: "delay", ms };
        return;
      }
      case "delayMicroseconds": return; // too short to matter at the simulator's timing resolution - treated as instant
      case "millis": return convert(Math.floor(this.host.millisNow()), "float", "ulong");
      case "micros": return convert(Math.floor(this.host.millisNow() * 1000), "float", "ulong");

      case "pulseIn":
        // Real pulseIn() blocks for as long as the pulse takes to arrive and
        // finish - approximated with a short real-time pause rather than 0, so
        // it reads as "the sensor took a moment to respond".
        yield { type: "delay", ms: 30 };
        return hw.pulseIn ? hw.pulseIn(args[0], args[1]) >>> 0 : 0;

      case "tone":
        this.pinModes.set(args[0], MODE_OUTPUT);
        hw.tone?.(args[0], args[1], args[2]);
        return;
      case "noTone": hw.noTone?.(args[0]); return;

      case "abs": return node.ctype === "float" ? Math.abs(args[0]) : convert(Math.abs(convert(args[0], types[0], node.ctype)), "long", node.ctype);
      case "min":
      case "max": {
        const first = compare(name === "min" ? "<=" : ">=", args[0], types[0], args[1], types[1]);
        return convert(first ? args[0] : args[1], first ? types[0] : types[1], node.ctype);
      }
      case "constrain": {
        const [x, lo, hi] = args;
        let v = x;
        let t = types[0];
        if (compare("<", x, types[0], lo, types[1])) { v = lo; t = types[1]; } else if (compare(">", x, types[0], hi, types[2])) { v = hi; t = types[2]; }
        return convert(v, t, node.ctype);
      }
      case "sq": return this.arithmetic("*", args[0], types[0], args[0], types[0], line).value;
      case "map": {
        // Arduino's map() does whole-number (long) arithmetic, so the result
        // is rounded DOWN (towards zero), never a fraction.
        const [x, inMin, inMax, outMin, outMax] = args;
        if (inMax === inMin) throw new SimError("map(): fromLow and fromHigh can't be the same number (that would divide by zero)", line);
        const scaled = this.arithmetic("*", x - inMin, "long", outMax - outMin, "long", line).value;
        return convert(Math.trunc(scaled / (inMax - inMin)) + outMin, "long", "long");
      }
      case "random": {
        const [a, b] = args;
        const [lo, hi] = rawArgs.length >= 2 ? [a, b] : [0, a];
        if (hi <= lo) return rawArgs.length >= 2 ? lo : 0; // matches the real random()
        return lo + Math.floor(this.random() * (hi - lo));
      }
      case "randomSeed":
        if (args[0] !== 0) this.random = makeRandom(args[0]); // the real randomSeed(0) does nothing
        return;
      case "sqrt": return Math.fround(Math.sqrt(args[0]));
      case "pow": return Math.fround(Math.pow(args[0], args[1]));
      case "sin": return Math.fround(Math.sin(args[0]));
      case "cos": return Math.fround(Math.cos(args[0]));
      case "tan": return Math.fround(Math.tan(args[0]));
      case "floor": return Math.fround(Math.floor(args[0]));
      case "ceil": return Math.fround(Math.ceil(args[0]));
      case "round": return convert(args[0] >= 0 ? Math.trunc(args[0] + 0.5) : Math.trunc(args[0] - 0.5), "float", "long");

      case "String": return rawArgs.length ? formatValue(rawArgs[0], types[0], rawArgs[1]) : "";
      case "F": return rawArgs[0];

      case "Serial.begin":
        this.serialStarted = true;
        for (const pin of [0, 1]) if (this.pinModes.has(pin)) this.checkSerialPin(pin, line);
        return;
      case "Serial.print": {
        const text = this.printText(rawArgs[0], types[0], rawArgs[1], name, line);
        this.host.print(text);
        return text.length;
      }
      case "Serial.println": {
        const text = this.printText(rawArgs[0], types[0], rawArgs[1], name, line) + "\n";
        this.host.print(text);
        return text.length + 1;
      }
      case "Serial.write": {
        const text = isTextType(types[0]) ? String(rawArgs[0]) : String.fromCharCode(convert(rawArgs[0], types[0], "byte"));
        this.host.print(this.printText(text, "String", undefined, name, line));
        return text.length;
      }
      case "Serial.flush": return;

      default:
        throw new SimError(`'${name}' is not supported in this simulator yet`, line);
    }
  }

  callMethod(binding, node, rawArgs, types) {
    const obj = binding.value;
    const method = node.callee.property;
    const line = node.line;
    const sig = METHODS[node.objectType][method];
    const args = rawArgs.map((v, i) => {
      const p = sig.params[i];
      return p && p !== "any" ? this.store(v, types[i], p, line) : v;
    });
    const hw = this.hw;

    if (node.objectType === "String") {
      if (method === "length") return obj.length;
    }

    if (node.objectType === "Servo") {
      switch (method) {
        case "attach":
          obj.pin = args[0];
          this.pinModes.set(args[0], MODE_OUTPUT);
          return 1;
        case "write":
          // Like the real Servo library, values above 180 are treated as
          // microseconds rather than degrees - but beginners mean degrees, so
          // clamp to 0-180 here and keep it simple.
          obj.angle = Math.min(Math.max(args[0], 0), 180);
          hw.servoWrite?.(obj.pin, obj.angle);
          return;
        case "writeMicroseconds":
          obj.angle = Math.min(Math.max(((args[0] - 544) / (2400 - 544)) * 180, 0), 180);
          hw.servoWrite?.(obj.pin, obj.angle);
          return;
        case "read": return Math.round(obj.angle);
        case "attached": return obj.pin !== null;
        case "detach": obj.pin = null; return;
        default: break;
      }
    }

    if (node.objectType === "LiquidCrystal") {
      switch (method) {
        case "begin": hw.lcdBegin?.(args[0], args[1]); return;
        case "print": {
          const text = formatValue(rawArgs[0], types[0], rawArgs[1]);
          hw.lcdPrint?.(text);
          return text.length;
        }
        case "write": {
          const text = isTextType(types[0]) ? String(rawArgs[0]) : String.fromCharCode(convert(rawArgs[0], types[0], "byte"));
          hw.lcdPrint?.(text);
          return text.length;
        }
        case "setCursor": hw.lcdSetCursor?.(args[0], args[1]); return;
        case "clear": hw.lcdClear?.(); return;
        case "home": hw.lcdSetCursor?.(0, 0); return;
        default: break;
      }
    }
    throw new SimError(`${node.objectType} has no method '${method}'`, line);
  }
}

// analogRead() results are always a whole number 0-1023.
function wrapResult(v) {
  return Math.max(0, Math.min(1023, Math.round(Number(v) || 0)));
}

// ================================================================== runner
// Drives the generator produced by Interpreter.run(). Handles: real-time
// pacing for delay(), a periodic "yield to the browser" so a tight loop with
// no delay() can never freeze the tab, a total wall-clock safety limit, and
// cooperative stopping via controller.stop().

const TICKS_BEFORE_YIELD = 300; // how many statements to run before giving the browser a turn
const MAX_RUN_MS = 300000;      // auto-stop safety net for runaway programs (5 min of real time - generous, since projects like the alarm/reaction-timer involve slow, exploratory button-pressing)

// The clock and timers the runner uses. Real ones by default; tests pass a
// fake set so "5 seconds" of a sketch can be checked instantly.
const realTiming = {
  now: () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id),
};

// startProgram(source, hardwareApi, { onOutput, onError, onStopped, onWarning }, options)
//
// options.timeScale (default 1) is an explicit speed setting: 1 is real
// Arduino timing, 2 runs everything twice as fast (delays wait half as
// long AND millis() counts twice as fast, so the sketch can't tell the
// difference). Nothing changes timing unless a caller asks for it.
//
// onError(message, { kind, line, message }) - the second argument says what
// kind of error it was (see classifyError).
//
// Returns { stop() }. After stop() - or after an error - nothing scheduled by
// this run can ever resume it: the pending timer is cancelled, and every
// callback checks the run's own `stopped` flag first.
export function startProgram(source, api, { onError, onStopped, onOutput, onWarning } = {}, options = {}) {
  const timing = { ...realTiming, ...(options.timing || {}) };
  const timeScale = options.timeScale > 0 ? options.timeScale : 1;
  const report = (fn, ...args) => { try { fn?.(...args); } catch (e) { console.error(e); } };
  const reportError = (e) => {
    if (!(e instanceof SimError)) console.error(e);
    const details = classifyError(e);
    report(onError, details.message, details);
  };

  let program;
  let functions;
  try {
    const compiled = compile(source);
    program = compiled.program;
    functions = compiled.functions;
    for (const w of compiled.warnings) report(onWarning, w);
  } catch (e) {
    reportError(e);
    return { stop() {} };
  }

  let stopped = false;
  let pendingTimer = null;
  const startedAt = timing.now();
  // millis() is simulated time since the run started. With timeScale 1 that
  // is real elapsed time - like real hardware, where millis() is driven by a
  // hardware timer that keeps counting no matter what the sketch is doing (a
  // sketch that waits for a button with no delay() still sees millis()
  // advance) - minus `lag`, the time lost to browser timers firing late
  // (see wakeAt).
  let lag = 0;
  const simNow = () => (timing.now() - startedAt) * timeScale - lag;

  const host = {
    millisNow: simNow,
    print: (text) => { if (!stopped) report(onOutput, text); },
    warn: (message) => { if (!stopped) report(onWarning, message); },
  };
  // A stopped run must never touch the board again, even if something odd
  // kept it alive - every hardware call checks the flag first.
  const hw = {};
  for (const [key, fn] of Object.entries(api || {})) {
    hw[key] = typeof fn === "function" ? (...args) => (stopped ? undefined : fn(...args)) : fn;
  }

  const interpreter = new Interpreter(program, functions, hw, host);
  const gen = interpreter.run();

  function schedule(fn, realMs) {
    pendingTimer = timing.setTimer(() => {
      pendingTimer = null;
      if (!stopped) fn();
    }, Math.max(0, realMs));
  }

  function finish(callback, ...args) {
    if (stopped) return;
    stopped = true;
    if (pendingTimer !== null) timing.clearTimer(pendingTimer);
    pendingTimer = null;
    report(callback, ...args);
  }

  // Resumes the sketch once simulated time reaches `target`. Browser timers
  // can fire a little early, so if one does, it just waits out the rest.
  // More often they fire a little late (a lot later in a background tab) -
  // but on a Uno, delay(500) ends exactly 500 ms after it started. So the
  // lateness comes off the clock instead of piling up in millis(): after
  // delay(500), millis() is exactly 500 later, every time.
  function wakeAt(target) {
    const remaining = target - simNow();
    if (remaining > 0) {
      schedule(() => wakeAt(target), remaining / timeScale);
      return;
    }
    lag -= remaining; // how late this wake-up is
    pump();
  }

  function pump() {
    let ticks = 0;
    while (!stopped) {
      if (timing.now() - startedAt > MAX_RUN_MS) {
        finish(onStopped, "Stopped automatically after running for 5 minutes - click Run to start again.");
        return;
      }
      let result;
      try {
        result = gen.next();
      } catch (e) {
        if (!(e instanceof SimError)) console.error(e);
        const details = classifyError(e);
        finish(onError, details.message, details);
        return;
      }
      if (result.done) {
        finish(onStopped, null);
        return;
      }
      const step = result.value;
      if (step.type === "delay") {
        if (step.ms > 0) {
          wakeAt(simNow() + step.ms);
          return;
        }
        continue; // delay(0) returns straight away, like on real hardware
      }
      // "tick": a checkpoint after each statement, used to periodically hand
      // control back to the browser so the page (and the Stop button) stay
      // responsive even in a loop with no delay().
      if (++ticks >= TICKS_BEFORE_YIELD) {
        schedule(pump, 0);
        return;
      }
    }
  }

  pump();

  return {
    stop() {
      stopped = true;
      if (pendingTimer !== null) timing.clearTimer(pendingTimer);
      pendingTimer = null;
    },
  };
}
