// A small interpreter for a SUBSET of Arduino C++ - variables, arrays,
// if/else, for/while, your own functions (with parameters and return
// values), the built-in pinMode/digitalWrite/digitalRead/delay functions,
// and Serial output AND input (Serial.available/read/parseInt/...). This is NOT a
// real C++ compiler - it's a tree-walking interpreter, the same basic
// technique used by simple scripting language engines.
//
// Pipeline: source text -> tokenize() -> parse() -> an AST (Abstract Syntax
// Tree, a tree of objects describing the program's structure) -> run(),
// which walks that tree and actually executes it against a hardware API
// (see board.js) supplied by the caller.
//
// delay() is the tricky part: real Arduino code blocks for N milliseconds.
// We can't freeze the browser tab for that long, so the evaluator is written
// as a generator function (function*) - calling delay() does `yield` instead
// of blocking, handing control back to a scheduler (see run() at the bottom)
// which waits the right amount of *real* time before resuming exactly where
// execution left off. This is also what lets a button click affect a
// digitalRead() that hasn't happened yet - the program genuinely pauses.

// ---------- Tokenizer ----------

const KEYWORDS = new Set([
  "void", "int", "float", "double", "bool", "boolean", "char", "long", "byte",
  "unsigned", "String", "const", "if", "else", "for", "while", "return",
  "break", "continue", "true", "false",
]);

// The keywords that can start a variable/parameter type. ("void" is only
// valid as a function return type, so it's handled separately.)
const TYPE_KEYWORDS = new Set([
  "int", "float", "double", "bool", "boolean", "char", "long", "byte", "unsigned", "String", "const",
]);

function stripDefines(source) {
  // Very small #define support: textual find-and-replace before tokenizing,
  // matching how the real C++ preprocessor treats simple #define macros.
  const lines = source.split("\n");
  const defines = [];
  const kept = [];
  for (const line of lines) {
    const m = line.match(/^\s*#define\s+(\w+)\s+(.+?)\s*$/);
    if (m) {
      defines.push([m[1], m[2]]);
      kept.push(""); // keep line numbers aligned
    } else if (/^\s*#include/.test(line)) {
      kept.push(""); // ignore includes entirely - we don't support libraries yet
    } else {
      kept.push(line);
    }
  }
  let text = kept.join("\n");
  for (const [name, value] of defines) {
    text = text.replace(new RegExp(`\\b${name}\\b`, "g"), value);
  }
  return text;
}

// Backslash escapes inside "..." and '...' - without this, "\n" would come
// out as a literal letter n instead of a new line.
const ESCAPES = { n: "\n", t: "\t", r: "\r", "0": "\0" };
function unescapeChar(c) { return ESCAPES[c] ?? c; }

function tokenize(source) {
  const src = stripDefines(source);
  const tokens = [];
  let i = 0;
  let line = 1;
  const n = src.length;

  function peekAt(offset) { return src[i + offset]; }

  while (i < n) {
    const c = src[i];

    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }

    if (c === "/" && peekAt(1) === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && peekAt(1) === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && peekAt(1) === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      i += 2;
      continue;
    }

    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(peekAt(1)))) {
      let start = i;
      while (i < n && /[0-9.]/.test(src[i])) i++;
      tokens.push({ type: "NUMBER", value: parseFloat(src.slice(start, i)), line });
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      let start = i;
      while (i < n && /[A-Za-z0-9_]/.test(src[i])) i++;
      const word = src.slice(start, i);
      tokens.push({ type: KEYWORDS.has(word) ? "KEYWORD" : "IDENT", value: word, line });
      continue;
    }

    if (c === '"') {
      let start = ++i;
      let out = "";
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < n) { out += unescapeChar(src[i + 1]); i += 2; }
        else { out += src[i]; i++; }
      }
      i++;
      tokens.push({ type: "STRING", value: out, line });
      continue;
    }

    if (c === "'") {
      let start = ++i;
      let ch = src[i];
      if (ch === "\\") { ch = unescapeChar(src[i + 1]); i += 2; } else { i++; }
      i++; // closing quote
      tokens.push({ type: "CHAR", value: ch, line });
      continue;
    }

    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/="].includes(two)) {
      tokens.push({ type: "OP", value: two, line });
      i += 2;
      continue;
    }

    if ("{}()[];,.+-*/%<>=!&|".includes(c)) {
      tokens.push({ type: "OP", value: c, line });
      i++;
      continue;
    }

    throw new SimError(`Unrecognized character '${c}'`, line);
  }

  tokens.push({ type: "EOF", value: null, line });
  return tokens;
}

export class SimError extends Error {
  constructor(message, line) {
    super(line ? `Line ${line}: ${message}` : message);
    this.line = line;
  }
}

// ---------- Parser (recursive descent) ----------
// Turns the flat token list into a tree. Each parseX() function corresponds
// to one grammar rule (see comment block at the top of the file for context);
// this structure mirrors how real compilers/interpreters are built.

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }
  check(type, value) {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }
  match(type, value) {
    if (this.check(type, value)) return this.advance();
    return null;
  }
  expect(type, value, what) {
    const t = this.match(type, value);
    if (!t) {
      const found = this.peek();
      throw new SimError(
        `Expected ${what || value || type} but found '${found.value ?? found.type}'`,
        found.line
      );
    }
    return t;
  }

  parseProgram() {
    const globals = [];
    const functions = {};
    while (!this.check("EOF")) {
      if (this.isFunctionDeclStart()) {
        const fn = this.parseFunctionDecl();
        if (!fn.body) continue; // a prototype like "int add(int a, int b);" - the real definition comes later
        if (functions[fn.name]) {
          throw new SimError(`The function '${fn.name}' is defined twice - give each function its own name`, fn.line);
        }
        functions[fn.name] = fn;
      } else {
        globals.push(this.parseVarDeclStatement());
      }
    }
    return { type: "Program", globals, functions };
  }

  isTypeKeyword() {
    const t = this.peek();
    if (t.type !== "KEYWORD") return false;
    return TYPE_KEYWORDS.has(t.value);
  }

  // "int add(" / "unsigned long elapsed(" / "void blink(" at the top level is
  // a function; "int ledPin = 13;" is a variable. Both start with a type and
  // a name, so we peek past them (without consuming anything) and check for
  // the "(" that only a function has. Only built-in type keywords count here:
  // "LiquidCrystal lcd(12, 11, ...)" also has a "(" but is an object
  // declaration with constructor arguments, not a function.
  isFunctionDeclStart() {
    let i = this.pos;
    while (this.tokens[i].type === "KEYWORD" && ["const", "unsigned"].includes(this.tokens[i].value)) i++;
    const typeTok = this.tokens[i];
    if (typeTok.type !== "KEYWORD" || !(typeTok.value === "void" || TYPE_KEYWORDS.has(typeTok.value))) return false;
    const nameTok = this.tokens[i + 1];
    const parenTok = this.tokens[i + 2];
    return nameTok.type === "IDENT" && parenTok.type === "OP" && parenTok.value === "(";
  }

  // Two identifiers in a row ("Servo myServo", "LiquidCrystal lcd") can only be
  // a declaration in this grammar - a bare identifier can never be directly
  // followed by another bare identifier in an expression. This lets us support
  // library object types (Servo, LiquidCrystal, ...) without hardcoding a list
  // of their names anywhere in the parser.
  isObjectDeclStart() {
    if (!this.check("IDENT")) return false;
    const next = this.tokens[this.pos + 1];
    return !!next && next.type === "IDENT";
  }

  isVarDeclStart() {
    return this.isTypeKeyword() || this.isObjectDeclStart();
  }

  // Consumes a type such as "int", "const byte", "unsigned long", "String" or
  // "Servo" and returns its base name. "unsigned" is dropped - the simulator
  // doesn't model integer sizes/overflow, so "unsigned long" behaves as "long".
  parseTypeName() {
    let isConst = false;
    if (this.match("KEYWORD", "const")) isConst = true;
    if (this.check("KEYWORD", "unsigned")) {
      this.advance();
      // a bare "unsigned x" means "unsigned int x"
      if (!this.isTypeKeyword()) return { typeName: "int", isConst };
    }
    const t = this.advance();
    if (t.type !== "KEYWORD" && t.type !== "IDENT") {
      throw new SimError(`Expected a type like int or float but found '${t.value ?? t.type}'`, t.line);
    }
    return { typeName: t.value, isConst };
  }

  parseFunctionDecl() {
    const line = this.peek().line;
    const { typeName: returnType } = this.parseTypeName();
    const name = this.expect("IDENT", undefined, "function name").value;
    this.expect("OP", "(");
    const params = [];
    if (this.check("KEYWORD", "void") && this.tokens[this.pos + 1].value === ")") {
      this.advance(); // "int readSensor(void)" - old C style for "no parameters"
    } else if (!this.check("OP", ")")) {
      params.push(this.parseParam());
      while (this.match("OP", ",")) params.push(this.parseParam());
    }
    this.expect("OP", ")");
    if (this.match("OP", ";")) return { type: "FuncDecl", name, returnType, params, body: null, line };
    const body = this.parseBlock();
    return { type: "FuncDecl", name, returnType, params, body, line };
  }

  // One parameter: "int pin", "float values[]", "int grid[][3]". In a
  // prototype the name is optional ("int add(int, int);").
  parseParam() {
    const line = this.peek().line;
    const { typeName } = this.parseTypeName();
    if (this.check("OP", "&") || this.check("OP", "*")) {
      throw new SimError(
        `Reference/pointer parameters ('${this.peek().value}') aren't supported in this simulator yet - pass the value and return the result instead`,
        line
      );
    }
    const nameTok = this.match("IDENT");
    let isArray = false;
    while (this.match("OP", "[")) {
      isArray = true;
      if (!this.check("OP", "]")) this.parseExpr(); // a size in a parameter is allowed but ignored, like real C++
      this.expect("OP", "]");
    }
    return { name: nameTok ? nameTok.value : null, typeName, isArray, line };
  }

  parseVarDeclStatement() {
    const decl = this.parseVarDecl();
    this.expect("OP", ";");
    return decl;
  }

  parseVarDecl() {
    const line = this.peek().line;
    // consume the type keyword/name (int/float/bool/String/Servo/LiquidCrystal/...)
    const { typeName, isConst } = this.parseTypeName();

    // A single "type" can declare several variables at once, comma-separated -
    // e.g. int trigPin = 6, echoPin = 5; - a very common real Arduino pattern.
    const declarators = [this.parseDeclarator()];
    while (this.match("OP", ",")) declarators.push(this.parseDeclarator());

    return { type: "VarDecl", typeName, isConst, declarators, line };
  }

  // One name (and optional array size, initializer or constructor args)
  // within a declaration - "trigPin = 6" is one declarator, "echoPin = 5" is
  // another, both sharing the "int" type from parseVarDecl. Arrays look like
  // "pins[3] = {2, 3, 4}", "readings[10]", "grid[2][3]" or msg[] = "hi".
  parseDeclarator() {
    const nameTok = this.expect("IDENT", undefined, "variable name");
    const name = nameTok.value;
    const dims = [];
    while (this.match("OP", "[")) {
      dims.push(this.check("OP", "]") ? null : this.parseExpr());
      this.expect("OP", "]");
    }
    let init = null;
    if (!dims.length && this.match("OP", "(")) {
      // Constructor-style declaration, e.g. LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
      // We don't need the actual pin numbers for the simulation (the display
      // isn't wired pin-by-pin), but PARSING them means real Arduino code
      // using a real library still copy-pastes in without a syntax error.
      if (!this.check("OP", ")")) {
        this.parseExpr();
        while (this.match("OP", ",")) this.parseExpr();
      }
      this.expect("OP", ")");
    } else if (this.match("OP", "=")) {
      init = this.check("OP", "{") ? this.parseInitList() : this.parseExpr();
    }
    return { name, dims, init, line: nameTok.line };
  }

  // "{1, 2, 3}" or, for 2D arrays, "{{1, 2}, {3, 4}}". A trailing comma
  // before the closing brace is allowed, as in real C++.
  parseInitList() {
    const line = this.expect("OP", "{").line;
    const items = [];
    while (!this.check("OP", "}")) {
      items.push(this.check("OP", "{") ? this.parseInitList() : this.parseExpr());
      if (!this.match("OP", ",")) break;
    }
    this.expect("OP", "}");
    return { type: "InitList", items, line };
  }

  parseBlock() {
    this.expect("OP", "{");
    const stmts = [];
    while (!this.check("OP", "}")) {
      stmts.push(this.parseStatement());
    }
    this.expect("OP", "}");
    return { type: "Block", stmts };
  }

  parseStatement() {
    if (this.check("OP", "{")) return this.parseBlock();
    if (this.check("KEYWORD", "if")) return this.parseIf();
    if (this.check("KEYWORD", "for")) return this.parseFor();
    if (this.check("KEYWORD", "while")) return this.parseWhile();
    if (this.check("KEYWORD", "break")) {
      const line = this.advance().line;
      this.expect("OP", ";");
      return { type: "Break", line };
    }
    if (this.check("KEYWORD", "continue")) {
      const line = this.advance().line;
      this.expect("OP", ";");
      return { type: "Continue", line };
    }
    if (this.check("KEYWORD", "return")) {
      const line = this.advance().line;
      const value = this.check("OP", ";") ? null : this.parseExpr();
      this.expect("OP", ";");
      return { type: "Return", value, line };
    }
    if (this.isVarDeclStart()) {
      return this.parseVarDeclStatement();
    }
    const line = this.peek().line;
    const expr = this.parseExpr();
    this.expect("OP", ";");
    return { type: "ExprStmt", expr, line };
  }

  parseIf() {
    this.expect("KEYWORD", "if");
    this.expect("OP", "(");
    const cond = this.parseExpr();
    this.expect("OP", ")");
    const then = this.parseStatement();
    let elseBranch = null;
    if (this.match("KEYWORD", "else")) {
      elseBranch = this.parseStatement();
    }
    return { type: "If", cond, then, else: elseBranch };
  }

  parseFor() {
    this.expect("KEYWORD", "for");
    this.expect("OP", "(");
    let init = null;
    if (!this.check("OP", ";")) {
      init = this.isVarDeclStart() ? this.parseVarDecl() : { type: "ExprStmt", expr: this.parseExpr() };
    }
    this.expect("OP", ";");
    let cond = null;
    if (!this.check("OP", ";")) cond = this.parseExpr();
    this.expect("OP", ";");
    let update = null;
    if (!this.check("OP", ")")) update = this.parseExpr();
    this.expect("OP", ")");
    const body = this.parseStatement();
    return { type: "For", init, cond, update, body };
  }

  parseWhile() {
    this.expect("KEYWORD", "while");
    this.expect("OP", "(");
    const cond = this.parseExpr();
    this.expect("OP", ")");
    const body = this.parseStatement();
    return { type: "While", cond, body };
  }

  parseExpr() { return this.parseAssignment(); }

  parseAssignment() {
    const left = this.parseLogicalOr();
    if (this.check("OP", "=") || this.check("OP", "+=") || this.check("OP", "-=") ||
        this.check("OP", "*=") || this.check("OP", "/=")) {
      const op = this.advance().value;
      const value = this.parseAssignment();
      return { type: "Assign", op, target: left, value };
    }
    return left;
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.check("OP", "||")) {
      const op = this.advance().value;
      left = { type: "Binary", op, left, right: this.parseLogicalAnd() };
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.check("OP", "&&")) {
      const op = this.advance().value;
      left = { type: "Binary", op, left, right: this.parseEquality() };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (this.check("OP", "==") || this.check("OP", "!=")) {
      const op = this.advance().value;
      left = { type: "Binary", op, left, right: this.parseComparison() };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseTerm();
    while (this.check("OP", "<") || this.check("OP", "<=") || this.check("OP", ">") || this.check("OP", ">=")) {
      const op = this.advance().value;
      left = { type: "Binary", op, left, right: this.parseTerm() };
    }
    return left;
  }

  parseTerm() {
    let left = this.parseFactor();
    while (this.check("OP", "+") || this.check("OP", "-")) {
      const op = this.advance().value;
      left = { type: "Binary", op, left, right: this.parseFactor() };
    }
    return left;
  }

  parseFactor() {
    let left = this.parseUnary();
    while (this.check("OP", "*") || this.check("OP", "/") || this.check("OP", "%")) {
      const op = this.advance().value;
      left = { type: "Binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.check("OP", "!") || this.check("OP", "-")) {
      const op = this.advance().value;
      return { type: "Unary", op, expr: this.parseUnary() };
    }
    if (this.check("OP", "++") || this.check("OP", "--")) {
      const op = this.advance().value;
      return { type: "Update", op, expr: this.parseUnary(), prefix: true };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();
    while (this.check("OP", "++") || this.check("OP", "--")) {
      const op = this.advance().value;
      expr = { type: "Update", op, expr, prefix: false };
    }
    return expr;
  }

  parsePrimary() {
    const t = this.peek();

    if (t.type === "NUMBER") { this.advance(); return { type: "Literal", value: t.value }; }
    if (t.type === "STRING") { this.advance(); return { type: "Literal", value: t.value }; }
    if (t.type === "CHAR") { this.advance(); return { type: "Literal", value: t.value }; }
    if (this.check("KEYWORD", "true")) { this.advance(); return { type: "Literal", value: true }; }
    if (this.check("KEYWORD", "false")) { this.advance(); return { type: "Literal", value: false }; }

    if (this.match("OP", "(")) {
      const expr = this.parseExpr();
      this.expect("OP", ")");
      return expr;
    }

    // sizeof(int) takes a TYPE, which isn't an expression, so it needs its
    // own case. sizeof(myArray) - the usual way to count an array's
    // elements, as sizeof(myArray) / sizeof(myArray[0]) - is handled here too.
    if (t.type === "IDENT" && t.value === "sizeof" && this.tokens[this.pos + 1].value === "(") {
      this.advance();
      this.expect("OP", "(");
      let node;
      if (this.isTypeKeyword()) node = { type: "SizeofType", typeName: this.parseTypeName().typeName, line: t.line };
      else node = { type: "Sizeof", expr: this.parseExpr(), line: t.line };
      this.expect("OP", ")");
      return node;
    }

    // String(42) / String(3.14159, 2) - converting a value to text.
    const isStringConversion = this.check("KEYWORD", "String") && this.tokens[this.pos + 1].value === "(";

    if (t.type === "IDENT" || isStringConversion) {
      this.advance();
      let node = { type: "Ident", name: t.value, line: t.line };
      for (;;) {
        if (this.match("OP", ".")) {
          const prop = this.expect("IDENT", undefined, "member name").value;
          node = { type: "Member", object: node, property: prop, line: t.line };
        } else if (this.match("OP", "[")) {
          const index = this.parseExpr();
          this.expect("OP", "]");
          node = { type: "Index", object: node, index, line: t.line };
        } else if (this.check("OP", "(")) {
          this.advance();
          const args = [];
          if (!this.check("OP", ")")) {
            args.push(this.parseExpr());
            while (this.match("OP", ",")) args.push(this.parseExpr());
          }
          this.expect("OP", ")");
          node = { type: "Call", callee: node, args, line: t.line };
        } else {
          break;
        }
      }
      return node;
    }

    throw new SimError(`Unexpected token '${t.value ?? t.type}'`, t.line);
  }
}

export function parse(source) {
  return new Parser(tokenize(source)).parseProgram();
}

// ---------- Evaluator ----------
// A generator-based tree walker. `yield`ing a {type:'delay', ms} object is
// how delay() pauses without blocking the browser - see run() below for the
// scheduler that resumes it.

const CONSTANTS = {
  HIGH: 1, LOW: 0,
  OUTPUT: "OUTPUT", INPUT: "INPUT", INPUT_PULLUP: "INPUT_PULLUP",
  LED_BUILTIN: 13,
  // Real Arduino Uno numbers its analog pins 14-19 internally (A0 = digital
  // pin 14, and so on) - matching that exactly means analogRead(A0) behaves
  // identically to real hardware, and the board's wiring system (which only
  // knows about numbered pins) needs no special-casing for "analog" pins.
  A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19,
};

class BreakSignal {}
class ContinueSignal {}
// Thrown by a `return` statement and caught by the function call that's
// returning - the same trick as break/continue above, since a return can
// happen arbitrarily deep inside nested loops and ifs.
class ReturnSignal {
  constructor(value) { this.value = value; }
}

const MAX_CALL_DEPTH = 200;       // a real Uno runs out of its 2KB of RAM long before this
const MAX_ARRAY_ELEMENTS = 10000; // stops a typo like int a[100000] from freezing the tab
const SERIAL_POLL_MS = 10;        // how often a waiting Serial.parseInt()/readString() checks for new input

// Bytes per value on an Arduino Uno, for sizeof(). "int" is 2 bytes there
// (not 4 like on a PC), which is why sizeof(myIntArray) is 2x the length.
const TYPE_SIZES = {
  char: 1, byte: 1, bool: 1, boolean: 1, int: 2, long: 4, float: 4, double: 4, String: 6,
};

function truthy(v) { return v !== 0 && v !== false && v !== "" && v != null; }

// There's no separate "char" type at runtime: a char is a 1-letter JS
// string ('A' is "A"). But in C++ a char is also a small number - 'A' is 65 -
// so code like `c - '0'` or `Serial.read() == 'y'` mixes the two. isChar()
// and charCode() let the operators below convert when that happens.
function isChar(v) { return typeof v === "string" && v.length === 1; }
function charCode(v) { return isChar(v) ? v.charCodeAt(0) : v; }

// Shared by BOTH places a variable can be declared without an initializer -
// globals (Interpreter.run) and locals (execStmt's VarDecl case). Keeping
// this in one function is deliberate: those two code paths drifting apart is
// exactly how a real bug shipped here once already (global `Servo myServo;`
// silently defaulted to 0 instead of a servo object, because only the local
// path knew about object types).
function defaultValueForType(typeName) {
  if (typeName === "Servo") return { __kind: "Servo", pin: null, angle: 90 };
  if (typeName === "LiquidCrystal") return { __kind: "LiquidCrystal" };
  if (typeName === "String") return "";
  return 0;
}

// Applied whenever a value is stored into a variable, parameter or array
// slot of a known type. Right now that only matters for char: storing a
// number (like what Serial.read() returns) into a char turns it into that
// letter, so `char c = Serial.read(); Serial.print(c);` prints "y", not 121.
function coerceForType(typeName, value) {
  if (typeName === "char" && typeof value === "number") return String.fromCharCode(value);
  if (typeName === "String" && typeof value === "number") return String(value);
  return value;
}

// Variables live in plain objects (one per scope, chained by prototype). A
// variable's declared type is stored alongside it under this prefixed key,
// which can never clash with a real identifier.
const TYPE_KEY = "\0type:";
function declare(scope, name, typeName, value) {
  scope[name] = value;
  scope[TYPE_KEY + name] = typeName;
}

function formatNumberAsString(value, decimals) {
  if (typeof value !== "number") return `${value}`;
  if (decimals !== undefined) return value.toFixed(decimals);
  return Number.isInteger(value) ? `${value}` : value.toFixed(2); // Arduino's String(float) shows 2 decimals
}

class Interpreter {
  constructor(ast, api) {
    this.ast = ast;
    this.api = api; // { pinMode, digitalWrite, digitalRead, analogRead, analogWrite, millisNow, print }
    this.globals = Object.create(null);
    for (const [k, v] of Object.entries(CONSTANTS)) this.globals[k] = v;
    this.callDepth = 0;
    this.loopCount = 0;
    // Text typed into the Serial Monitor that the sketch hasn't read yet -
    // the equivalent of the Arduino's 64-byte serial receive buffer.
    this.serialIn = "";
    this.serialTimeoutMs = 1000; // Arduino's default for parseInt()/readString()
  }

  sendSerial(text) {
    this.serialIn += text;
  }

  *run() {
    for (const decl of this.ast.globals) {
      for (const d of decl.declarators) yield* this.declareVar(decl.typeName, d, this.globals);
    }
    if (this.ast.functions.setup) yield* this.callUserFunction(this.ast.functions.setup, [], 0);
    if (!this.ast.functions.loop) return;
    for (;;) {
      yield* this.callUserFunction(this.ast.functions.loop, [], 0);
      this.loopCount++;
      yield { type: "tick" };
    }
  }

  // ---------- declarations ----------

  *declareVar(typeName, d, scope) {
    let value;
    if (d.dims.length) {
      const sizes = [];
      for (const size of d.dims) sizes.push(size ? this.toIndex(yield* this.evalExpr(size, scope), d.line) : null);
      let init = null;
      if (d.init) init = d.init.type === "InitList" ? yield* this.evalInitList(d.init, scope) : yield* this.evalExpr(d.init, scope);
      value = this.buildArray(typeName, sizes, init, d.line);
    } else {
      if (d.init && d.init.type === "InitList") {
        throw new SimError(`'${d.name}' isn't an array, so it can't be set with { braces } - did you forget the [ ]?`, d.line);
      }
      value = d.init ? yield* this.evalExpr(d.init, scope) : defaultValueForType(typeName);
      value = coerceForType(typeName, value);
    }
    declare(scope, d.name, typeName, value);
  }

  *evalInitList(list, scope) {
    const out = [];
    for (const item of list.items) {
      out.push(item.type === "InitList" ? yield* this.evalInitList(item, scope) : yield* this.evalExpr(item, scope));
    }
    return out;
  }

  // Arrays are plain JS arrays (nested ones for 2D), tagged with their
  // element type so stores into them are coerced and sizeof() knows the
  // element size. A char array set from a string literal - char msg[] = "hi" -
  // stays a JS string, so it can be printed whole like in real Arduino code.
  buildArray(typeName, sizes, init, line) {
    if (typeName === "char" && sizes.length === 1 && typeof init === "string") return init;
    if (init !== null && !Array.isArray(init)) {
      throw new SimError(`An array has to be set with a list in braces, like {1, 2, 3}`, line);
    }
    let total = 1;
    const build = (level, initPart) => {
      const size = sizes[level] ?? (initPart ? initPart.length : null);
      if (size === null) throw new SimError(`This array needs a size - put a number in the [ ] or give it a {list} of starting values`, line);
      if (size < 0) throw new SimError(`An array can't have a negative size`, line);
      if (initPart && initPart.length > size) {
        throw new SimError(`Too many starting values - the array only has room for ${size}`, line);
      }
      total *= size;
      if (total > MAX_ARRAY_ELEMENTS) throw new SimError(`That array is too big for this simulator (over ${MAX_ARRAY_ELEMENTS} elements)`, line);
      const arr = [];
      const isLast = level === sizes.length - 1;
      for (let i = 0; i < size; i++) {
        const part = initPart ? initPart[i] : undefined;
        if (isLast) {
          if (Array.isArray(part)) throw new SimError(`Too many levels of { braces } for this array`, line);
          arr.push(part === undefined ? defaultValueForType(typeName) : coerceForType(typeName, part));
        } else {
          if (part !== undefined && !Array.isArray(part)) throw new SimError(`Each row of a 2D array needs its own { braces }`, line);
          arr.push(build(level + 1, part));
        }
      }
      arr.elemType = typeName;
      return arr;
    };
    return build(0, init);
  }

  toIndex(v, line) {
    if (isChar(v)) return v.charCodeAt(0);
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v !== "number" || Number.isNaN(v)) throw new SimError(`An array index has to be a number`, line);
    return Math.trunc(v);
  }

  // ---------- statements ----------

  *execBlock(block, scope) {
    const local = Object.create(scope);
    for (const stmt of block.stmts) {
      yield* this.execStmt(stmt, local);
    }
  }

  *execStmt(stmt, scope) {
    yield { type: "tick" };
    switch (stmt.type) {
      case "Block":
        yield* this.execBlock(stmt, scope);
        return;
      case "VarDecl": {
        for (const d of stmt.declarators) yield* this.declareVar(stmt.typeName, d, scope);
        return;
      }
      case "ExprStmt":
        yield* this.evalExpr(stmt.expr, scope);
        return;
      case "If": {
        const cond = yield* this.evalExpr(stmt.cond, scope);
        if (truthy(cond)) yield* this.execStmt(stmt.then, scope);
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
        const local = Object.create(scope);
        if (stmt.init) yield* this.execStmt(stmt.init, local);
        while (stmt.cond ? truthy(yield* this.evalExpr(stmt.cond, local)) : true) {
          try {
            yield* this.execStmt(stmt.body, local);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (!(e instanceof ContinueSignal)) throw e;
          }
          if (stmt.update) yield* this.evalExpr(stmt.update, local);
        }
        return;
      }
      case "Break": throw new BreakSignal();
      case "Continue": throw new ContinueSignal();
      case "Return":
        throw new ReturnSignal(stmt.value ? yield* this.evalExpr(stmt.value, scope) : undefined);
      default:
        throw new SimError(`Cannot execute statement of type ${stmt.type}`, stmt.line);
    }
  }

  // ---------- user-defined functions ----------

  // Each call gets a fresh scope whose parent is the GLOBAL scope - not the
  // caller's - so a function sees its own parameters/locals plus globals,
  // but never the local variables of whoever called it (same as C++). That
  // fresh scope per call is also what makes recursion work.
  *callUserFunction(fn, args, line) {
    if (args.length !== fn.params.length) {
      throw new SimError(
        `${fn.name}() needs ${fn.params.length} argument${fn.params.length === 1 ? "" : "s"} but was given ${args.length}`,
        line
      );
    }
    if (this.callDepth >= MAX_CALL_DEPTH) {
      throw new SimError(`Too many function calls inside each other (over ${MAX_CALL_DEPTH}) - does ${fn.name}() keep calling itself without stopping?`, line);
    }
    const scope = Object.create(this.globals);
    fn.params.forEach((p, i) => {
      // Arrays are passed by reference, exactly like real C++: the function
      // gets the SAME array, so changes it makes are visible to the caller.
      if (p.isArray && !Array.isArray(args[i]) && typeof args[i] !== "string") {
        throw new SimError(`${fn.name}() expects an array for '${p.name}'`, line);
      }
      declare(scope, p.name, p.typeName, p.isArray ? args[i] : coerceForType(p.typeName, args[i]));
    });

    this.callDepth++;
    try {
      yield* this.execBlock(fn.body, scope);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        if (fn.returnType === "void" || e.value === undefined) return undefined;
        return coerceForType(fn.returnType, e.value);
      }
      if (e instanceof BreakSignal || e instanceof ContinueSignal) {
        throw new SimError(`'${e instanceof BreakSignal ? "break" : "continue"}' can only be used inside a loop (in ${fn.name}())`, fn.line);
      }
      throw e;
    } finally {
      this.callDepth--;
    }
    // Falling off the end of a non-void function without a return: real C++
    // returns garbage here. 0 is the friendliest stand-in.
    return fn.returnType === "void" ? undefined : coerceForType(fn.returnType, 0);
  }

  // ---------- expressions ----------

  findScope(name, scope) {
    let s = scope;
    while (s) {
      if (Object.prototype.hasOwnProperty.call(s, name)) return s;
      s = Object.getPrototypeOf(s);
    }
    return null;
  }

  // Resolves something that can be assigned to - a variable (x) or an array
  // element (readings[i], grid[r][c]) - into a get/set pair. Assignment and
  // ++/-- both go through this, so the array/index part is evaluated once.
  *resolveRef(target, scope) {
    if (target.type === "Ident") {
      const s = this.findScope(target.name, scope);
      if (!s) throw new SimError(`'${target.name}' was not declared before use`, target.line);
      const type = s[TYPE_KEY + target.name];
      return {
        type,
        get: () => s[target.name],
        set: (v) => {
          if (Array.isArray(s[target.name])) {
            throw new SimError(`You can't assign to a whole array at once - set its elements one at a time, like ${target.name}[0] = ...`, target.line);
          }
          s[target.name] = coerceForType(type, v);
        },
      };
    }
    if (target.type === "Index") {
      const container = yield* this.evalExpr(target.object, scope);
      const i = this.toIndex(yield* this.evalExpr(target.index, scope), target.line);
      if (typeof container === "string") {
        // A char array stored as a JS string - strings can't be changed in
        // place, so write back a rebuilt copy through the parent reference.
        this.checkBounds(container.length + 1, i, target);
        const assignable = target.object.type === "Ident" || target.object.type === "Index";
        const parent = assignable ? yield* this.resolveRef(target.object, scope) : null;
        return {
          type: "char",
          get: () => (parent ? parent.get() : container)[i] ?? "\0",
          set: (v) => {
            if (!parent) throw new SimError("Left side of assignment must be a variable or an array element", target.line);
            const s = parent.get();
            parent.set(s.slice(0, i) + coerceForType("char", v) + s.slice(i + 1));
          },
        };
      }
      if (!Array.isArray(container)) throw new SimError(`${describe(target.object)} is not an array, so it can't be used with [ ]`, target.line);
      this.checkBounds(container.length, i, target);
      return {
        type: container.elemType,
        get: () => container[i],
        set: (v) => {
          if (Array.isArray(container[i])) throw new SimError(`You can't assign to a whole row of a 2D array at once`, target.line);
          container[i] = coerceForType(container.elemType, v);
        },
      };
    }
    throw new SimError("Left side of assignment must be a variable or an array element", target.line);
  }

  // Reading past the end of an array is "undefined behavior" in real C++ -
  // it silently reads/corrupts other memory, one of the most confusing bugs
  // a beginner can hit. Here it's a clear error instead.
  checkBounds(length, i, node) {
    if (i < 0 || i >= length) {
      throw new SimError(
        `Index ${i} is outside the array ${describe(node.object)} (valid indexes are 0 to ${length - 1})`,
        node.line
      );
    }
  }

  *evalExpr(node, scope) {
    switch (node.type) {
      case "Literal": return node.value;
      case "Ident": {
        const s = this.findScope(node.name, scope) || this.globals;
        if (!(node.name in s)) {
          throw new SimError(`'${node.name}' was not declared - did you spell it correctly, or forget to declare it?`, node.line);
        }
        return s[node.name];
      }
      case "Index": {
        const ref = yield* this.resolveRef(node, scope);
        return ref.get();
      }
      case "Assign": {
        const ref = yield* this.resolveRef(node.target, scope);
        const value = yield* this.evalExpr(node.value, scope);
        if (node.op === "=") {
          ref.set(value);
        } else {
          // c += 1 on a char means "next letter", so do the math on its number
          let cur = ref.get();
          if (ref.type === "char") cur = charCode(cur);
          if (node.op === "+=") ref.set(cur + value);
          else if (node.op === "-=") ref.set(cur - charCode(value));
          else if (node.op === "*=") ref.set(cur * value);
          else if (node.op === "/=") ref.set(cur / value);
        }
        return ref.get();
      }
      case "Update": {
        const ref = yield* this.resolveRef(node.expr, scope);
        const oldVal = ref.get();
        const num = charCode(oldVal);
        ref.set(node.op === "++" ? num + 1 : num - 1);
        return node.prefix ? ref.get() : oldVal;
      }
      case "Unary": {
        const v = yield* this.evalExpr(node.expr, scope);
        if (node.op === "!") return !truthy(v);
        if (node.op === "-") return -charCode(v);
        return v;
      }
      case "Binary": {
        if (node.op === "&&") {
          const l = yield* this.evalExpr(node.left, scope);
          if (!truthy(l)) return false;
          return truthy(yield* this.evalExpr(node.right, scope));
        }
        if (node.op === "||") {
          const l = yield* this.evalExpr(node.left, scope);
          if (truthy(l)) return true;
          return truthy(yield* this.evalExpr(node.right, scope));
        }
        let l = yield* this.evalExpr(node.left, scope);
        let r = yield* this.evalExpr(node.right, scope);
        if (["-", "*", "/", "%"].includes(node.op)) {
          // pure arithmetic: a char always means its number ('7' - '0' is 7)
          l = charCode(l);
          r = charCode(r);
        } else if ((typeof l === "number") !== (typeof r === "number")) {
          // a number mixed with a char: Serial.read() == 'y', or 'a' + 1.
          // ("+" between a number and a longer String still joins text:
          // "Count: " + n - charCode() only converts single letters.)
          l = charCode(l);
          r = charCode(r);
        }
        switch (node.op) {
          case "+": return l + r;
          case "-": return l - r;
          case "*": return l * r;
          case "/": return l / r;
          case "%": return l % r;
          case "==": return l === r;
          case "!=": return l !== r;
          case "<": return l < r;
          case "<=": return l <= r;
          case ">": return l > r;
          case ">=": return l >= r;
          default: throw new SimError(`Unknown operator ${node.op}`);
        }
      }
      case "SizeofType":
        return TYPE_SIZES[node.typeName] ?? 2;
      case "Sizeof":
        return yield* this.evalSizeof(node.expr, scope);
      case "Member": {
        // Only "Serial.xxx" is supported - treat it as a namespaced builtin name.
        if (node.object.type === "Ident") return `${node.object.name}.${node.property}`;
        throw new SimError(`Unsupported member access`, node.line);
      }
      case "Call": {
        const args = [];
        const evalArgs = function* (self) {
          for (const a of node.args) args.push(yield* self.evalExpr(a, scope));
        };

        // Your own functions come first, so a sketch can define a helper
        // with any name it likes.
        if (node.callee.type === "Ident" && this.ast.functions[node.callee.name]) {
          yield* evalArgs(this);
          return yield* this.callUserFunction(this.ast.functions[node.callee.name], args, node.line);
        }

        // A call like myServo.write(90), lcd.print("hi") or name.length() is
        // a METHOD call on a value the sketch holds, not a fixed namespace
        // like Serial.println - it has to be resolved by looking at what
        // that value actually is, which only makes sense here (not in
        // resolveCalleeName, which has no access to real values, only names).
        if (node.callee.type === "Member") {
          const obj = node.callee.object;
          const isNamespace = obj.type === "Ident" && !this.findScope(obj.name, scope);
          if (!isNamespace) {
            const value = yield* this.evalExpr(obj, scope);
            yield* evalArgs(this);
            if (value && typeof value === "object" && value.__kind) {
              return this.callObjectMethod(value, node.callee.property, args, node.line);
            }
            if (typeof value === "string") {
              return yield* this.callStringMethod(obj, value, node.callee.property, args, scope, node.line);
            }
            throw new SimError(`${describe(obj)} has no method '${node.callee.property}'`, node.line);
          }
        }
        const name = yield* this.resolveCalleeName(node.callee, scope);
        yield* evalArgs(this);
        return yield* this.callBuiltin(name, args, node.line);
      }
      default:
        throw new SimError(`Cannot evaluate expression of type ${node.type}`, node.line);
    }
  }

  *evalSizeof(expr, scope) {
    let value;
    let typeName;
    if (expr.type === "Ident") {
      value = yield* this.evalExpr(expr, scope);
      const s = this.findScope(expr.name, scope);
      typeName = s && s[TYPE_KEY + expr.name];
    } else if (expr.type === "Index") {
      const container = yield* this.evalExpr(expr.object, scope);
      value = yield* this.evalExpr(expr, scope);
      typeName = typeof container === "string" ? "char" : container.elemType;
    } else {
      value = yield* this.evalExpr(expr, scope);
    }
    return sizeofValue(value, typeName);
  }

  *resolveCalleeName(callee, scope) {
    if (callee.type === "Ident") return callee.name;
    if (callee.type === "Member") return yield* this.evalExpr(callee, scope);
    throw new SimError("Unsupported function call");
  }

  // ---------- Serial input ----------

  // Waits (in simulated time, without freezing the page) until the Serial
  // Monitor has sent something, or the timeout passes. Returns whether
  // there's data. This is how parseInt()/readString() behave on a real board:
  // they block for up to 1 second waiting for the user to type.
  *waitForSerial() {
    let waited = 0;
    while (!this.serialIn.length && waited < this.serialTimeoutMs) {
      yield { type: "delay", ms: SERIAL_POLL_MS };
      waited += SERIAL_POLL_MS;
    }
    return this.serialIn.length > 0;
  }

  // Serial.parseInt()/parseFloat(): skip anything that isn't part of a
  // number, then read the number. Returns 0 if nothing arrives in time.
  *serialParseNumber(allowDecimal) {
    for (;;) {
      const m = this.serialIn.match(/^[^0-9.-]*/);
      this.serialIn = this.serialIn.slice(m[0].length);
      if (this.serialIn.length) break;
      if (!(yield* this.waitForSerial())) return 0;
    }
    const m = this.serialIn.match(allowDecimal ? /^-?[0-9]*\.?[0-9]*/ : /^-?[0-9]*/);
    let text = m[0];
    // a lone "-" or "." with no digits isn't a number - drop it and move on
    this.serialIn = this.serialIn.slice(Math.max(text.length, 1));
    const value = allowDecimal ? parseFloat(text) : parseInt(text, 10);
    return Number.isNaN(value) ? 0 : value;
  }

  // ---------- built-in functions ----------

  *callBuiltin(name, args, line) {
    const api = this.api;
    switch (name) {
      case "pinMode": api.pinMode(args[0], args[1]); return;
      case "digitalWrite": api.digitalWrite(args[0], args[1]); return;
      case "digitalRead": return api.digitalRead(args[0]);
      case "analogRead": return api.analogRead ? api.analogRead(args[0]) : 0;
      case "analogWrite": api.analogWrite && api.analogWrite(args[0], args[1]); return;
      case "delay": yield { type: "delay", ms: args[0] }; return;
      case "delayMicroseconds": return; // sub-millisecond - too short to meaningfully simulate, treated as instant
      case "millis": return api.millisNow();
      case "micros": return api.millisNow() * 1000;
      case "pulseIn":
        // Real pulseIn() blocks for as long as the pulse takes to arrive and
        // finish - we approximate that with a small fixed real-time pause
        // rather than 0, so it reads as "the sensor took a moment to respond"
        // instead of being suspiciously instantaneous.
        yield { type: "delay", ms: 30 };
        return api.pulseIn ? api.pulseIn(args[0], args[1]) : 0;
      case "tone": api.tone && api.tone(args[0], args[1], args[2]); return;
      case "noTone": api.noTone && api.noTone(args[0]); return;
      case "Serial.begin": return;
      case "Serial.end": return;
      case "Serial.flush": return;
      case "Serial.println": api.print(`${args[0] ?? ""}\n`); return;
      case "Serial.print": api.print(`${args[0] ?? ""}`); return;
      case "Serial.write": api.print(typeof args[0] === "number" ? String.fromCharCode(args[0]) : `${args[0] ?? ""}`); return;
      case "Serial.available": return this.serialIn.length;
      case "Serial.read": {
        // Returns the next character as a NUMBER (its ASCII code), or -1 if
        // nothing is waiting - exactly like the real Serial.read().
        if (!this.serialIn.length) return -1;
        const code = this.serialIn.charCodeAt(0);
        this.serialIn = this.serialIn.slice(1);
        return code;
      }
      case "Serial.peek": return this.serialIn.length ? this.serialIn.charCodeAt(0) : -1;
      case "Serial.parseInt": return yield* this.serialParseNumber(false);
      case "Serial.parseFloat": return yield* this.serialParseNumber(true);
      case "Serial.readString": {
        if (!(yield* this.waitForSerial())) return "";
        const text = this.serialIn;
        this.serialIn = "";
        return text;
      }
      case "Serial.readStringUntil": {
        if (!(yield* this.waitForSerial())) return "";
        const stop = isChar(args[0]) ? args[0] : String.fromCharCode(args[0]);
        const at = this.serialIn.indexOf(stop);
        const text = at === -1 ? this.serialIn : this.serialIn.slice(0, at);
        this.serialIn = at === -1 ? "" : this.serialIn.slice(at + 1);
        return text;
      }
      case "Serial.setTimeout": this.serialTimeoutMs = args[0]; return;
      case "String": return formatNumberAsString(args[0] ?? "", args[1]);
      case "abs": return Math.abs(args[0]);
      case "min": return Math.min(args[0], args[1]);
      case "max": return Math.max(args[0], args[1]);
      case "constrain": return Math.min(Math.max(args[0], args[1]), args[2]);
      case "map": {
        const [x, inMin, inMax, outMin, outMax] = args;
        return ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
      }
      case "random":
        return args.length >= 2
          ? Math.floor(Math.random() * (args[1] - args[0])) + args[0]
          : Math.floor(Math.random() * args[0]);
      default:
        throw new SimError(`'${name}' is not a supported function in this simulator yet`, line);
    }
  }

  // Methods on String values - mostly needed for text read from the Serial
  // Monitor (input.trim(), input.toInt(), input.equals("on"), ...). trim(),
  // toUpperCase() and toLowerCase() change the String IN PLACE in Arduino
  // (they don't return a new one), so those write back through a reference.
  *callStringMethod(objNode, str, method, args, scope, line) {
    switch (method) {
      case "length": return str.length;
      case "toInt": { const v = parseInt(str, 10); return Number.isNaN(v) ? 0 : v; }
      case "toFloat": { const v = parseFloat(str); return Number.isNaN(v) ? 0 : v; }
      case "equals": return str === `${args[0]}`;
      case "equalsIgnoreCase": return str.toLowerCase() === `${args[0]}`.toLowerCase();
      case "indexOf": return str.indexOf(`${args[0]}`, args[1] ?? 0);
      case "substring": return str.substring(args[0], args[1] ?? str.length);
      case "charAt": return str[args[0]] ?? "\0";
      case "startsWith": return str.startsWith(`${args[0]}`);
      case "endsWith": return str.endsWith(`${args[0]}`);
      case "trim":
      case "toUpperCase":
      case "toLowerCase": {
        const ref = yield* this.resolveRef(objNode, scope);
        const updated = method === "trim" ? str.trim() : method === "toUpperCase" ? str.toUpperCase() : str.toLowerCase();
        ref.set(updated);
        return;
      }
      default: throw new SimError(`String has no method '${method}'`, line);
    }
  }

  callObjectMethod(obj, method, args, line) {
    const api = this.api;

    if (obj.__kind === "Servo") {
      switch (method) {
        case "attach": obj.pin = args[0]; return;
        case "write":
          obj.angle = Math.min(Math.max(args[0], 0), 180);
          api.servoWrite && api.servoWrite(obj.pin, obj.angle);
          return;
        case "writeMicroseconds":
          obj.angle = Math.min(Math.max(((args[0] - 544) / (2400 - 544)) * 180, 0), 180);
          api.servoWrite && api.servoWrite(obj.pin, obj.angle);
          return;
        case "read": return obj.angle;
        case "detach": obj.pin = null; return;
        default: throw new SimError(`Servo has no method '${method}'`, line);
      }
    }

    if (obj.__kind === "LiquidCrystal") {
      switch (method) {
        case "begin": api.lcdBegin && api.lcdBegin(args[0], args[1]); return;
        case "print": api.lcdPrint && api.lcdPrint(`${args[0] ?? ""}`); return;
        case "write": api.lcdPrint && api.lcdPrint(String.fromCharCode(args[0])); return;
        case "setCursor": api.lcdSetCursor && api.lcdSetCursor(args[0], args[1]); return;
        case "clear": api.lcdClear && api.lcdClear(); return;
        case "home": api.lcdSetCursor && api.lcdSetCursor(0, 0); return;
        default: throw new SimError(`LiquidCrystal has no method '${method}'`, line);
      }
    }

    throw new SimError(`Unknown object - no method '${method}'`, line);
  }
}

function sizeofValue(value, typeName) {
  if (Array.isArray(value)) return value.length * sizeofValue(value[0] ?? 0, value.elemType);
  if (typeName === "char" && typeof value === "string" && value.length !== 1) return value.length + 1; // + the hidden '\0' at the end
  return TYPE_SIZES[typeName] ?? 2;
}

// A readable name for an expression in error messages: "readings", "grid[1]".
function describe(node) {
  if (node.type === "Ident") return `'${node.name}'`;
  if (node.type === "Index") return `${describe(node.object)}[...]`;
  return "that value";
}

export { Interpreter };

// ---------- Runner / scheduler ----------
// Drives the generator produced by Interpreter.run(). Handles: real-time
// pacing for delay(), a periodic "yield to the browser" so a tight loop with
// no delay() can never freeze the tab, a total wall-clock time limit, and
// cooperative stopping via controller.stop().

const MAX_DELAY_MS = 1500;      // cap how long any single delay() actually waits, so demos stay snappy
const TICKS_BEFORE_YIELD = 300; // how many statements to run synchronously before giving the browser a turn
const MAX_RUN_MS = 300000;      // auto-stop safety net for runaway/infinite programs (5 min - generous, since projects like the alarm/reaction-timer involve slow, exploratory manual button-pressing)

export function startProgram(source, api, { onError, onStopped, onOutput } = {}) {
  let ast;
  try {
    ast = parse(source);
  } catch (e) {
    onError && onError(e instanceof SimError ? e.message : String(e));
    return { stop() {}, sendSerial() {} };
  }
  if (!ast.functions.setup || !ast.functions.loop) {
    onError && onError("Every sketch needs both a setup() and a loop() function.");
    return { stop() {}, sendSerial() {} };
  }

  let stopped = false;
  let ticksSinceYield = 0;
  const startedAt = Date.now();

  // millis() tracks real wall-clock time since the run started - exactly like
  // real Arduino hardware, where it's driven by a hardware timer completely
  // independent of what the sketch is doing. This matters: code that waits
  // for something (like a button press) with no delay() in the loop - e.g. a
  // reaction-timer game - still needs millis() to keep advancing while it waits.
  const wrappedApi = {
    ...api,
    millisNow: () => Date.now() - startedAt,
    print: (text) => onOutput && onOutput(text),
  };

  const interpreter = new Interpreter(ast, wrappedApi);
  const gen = interpreter.run();

  function step(resumeValue) {
    if (stopped) return;
    if (Date.now() - startedAt > MAX_RUN_MS) {
      stopped = true;
      onStopped && onStopped("Stopped automatically after running for a while - click Run to start again.");
      return;
    }

    let result;
    try {
      result = gen.next(resumeValue);
    } catch (e) {
      stopped = true;
      let message = e instanceof SimError ? e.message : String(e);
      // Very deep recursion can hit the browser's own stack limit before
      // MAX_CALL_DEPTH does - report that the same friendly way.
      if (e instanceof RangeError) message = "Too many function calls inside each other - does a function keep calling itself without stopping?";
      onError && onError(message);
      return;
    }

    if (result.done) {
      stopped = true;
      onStopped && onStopped(null);
      return;
    }

    const value = result.value;
    if (value.type === "delay") {
      const realMs = Math.min(value.ms, MAX_DELAY_MS);
      setTimeout(() => step(), Math.max(realMs, 0));
      return;
    }

    // "tick" - just a checkpoint after each statement, used to periodically
    // hand control back to the browser so the UI (and Stop button) stay responsive.
    ticksSinceYield++;
    if (ticksSinceYield >= TICKS_BEFORE_YIELD) {
      ticksSinceYield = 0;
      setTimeout(() => step(), 0);
    } else {
      step();
    }
  }

  step();

  return {
    stop() {
      stopped = true;
    },
    // Text typed into the Serial Monitor - the sketch reads it with
    // Serial.available()/read()/parseInt()/readString().
    sendSerial(text) {
      if (!stopped) interpreter.sendSerial(text);
    },
  };
}
