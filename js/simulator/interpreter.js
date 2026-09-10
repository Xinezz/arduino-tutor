// A small interpreter for a SUBSET of Arduino C++ - just enough to run the
// code taught in Levels 1-2 (variables, if/else, for/while, the built-in
// pinMode/digitalWrite/digitalRead/delay/Serial functions). This is NOT a
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
        if (src[i] === "\\" && i + 1 < n) { out += src[i + 1]; i += 2; }
        else { out += src[i]; i++; }
      }
      i++;
      tokens.push({ type: "STRING", value: out, line });
      continue;
    }

    if (c === "'") {
      let start = ++i;
      let ch = src[i];
      if (ch === "\\") { ch = src[i + 1]; i += 2; } else { i++; }
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
      if (this.check("KEYWORD", "void")) {
        const fn = this.parseFunctionDecl();
        functions[fn.name] = fn;
      } else {
        globals.push(this.parseVarDeclStatement());
      }
    }
    return { type: "Program", globals, functions };
  }

  isTypeKeyword() {
    const t = this.peek();
    if (t.type !== "KEYWORD") return t.type === "IDENT" && t.value === "String" ? true : false;
    return ["int", "float", "double", "bool", "boolean", "char", "long", "byte", "unsigned", "String", "const"].includes(t.value);
  }

  parseFunctionDecl() {
    this.expect("KEYWORD", "void");
    const name = this.expect("IDENT", undefined, "function name").value;
    this.expect("OP", "(");
    this.expect("OP", ")");
    const body = this.parseBlock();
    return { type: "FuncDecl", name, body };
  }

  parseVarDeclStatement() {
    const decl = this.parseVarDecl();
    this.expect("OP", ";");
    return decl;
  }

  parseVarDecl() {
    let isConst = false;
    if (this.match("KEYWORD", "const")) isConst = true;
    if (this.check("KEYWORD", "unsigned")) this.advance(); // skip "unsigned", keep next type word
    // consume the type keyword (int/float/bool/char/String/...)
    this.advance();
    const name = this.expect("IDENT", undefined, "variable name").value;
    let init = null;
    if (this.match("OP", "=")) {
      init = this.parseExpr();
    }
    return { type: "VarDecl", name, init, isConst, line: this.peek().line };
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
      if (!this.check("OP", ";")) this.parseExpr();
      this.expect("OP", ";");
      return { type: "Return", line };
    }
    if (this.isTypeKeyword() && !this.check("IDENT")) {
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
      init = this.isTypeKeyword() ? this.parseVarDecl() : { type: "ExprStmt", expr: this.parseExpr() };
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

    if (t.type === "IDENT") {
      this.advance();
      let node = { type: "Ident", name: t.value, line: t.line };
      for (;;) {
        if (this.match("OP", ".")) {
          const prop = this.expect("IDENT", undefined, "member name").value;
          node = { type: "Member", object: node, property: prop };
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
};

class BreakSignal {}
class ContinueSignal {}

function truthy(v) { return v !== 0 && v !== false && v !== "" && v != null; }

class Interpreter {
  constructor(ast, api) {
    this.ast = ast;
    this.api = api; // { pinMode, digitalWrite, digitalRead, analogRead, analogWrite, millisNow, print }
    this.globals = Object.create(null);
    for (const [k, v] of Object.entries(CONSTANTS)) this.globals[k] = v;
  }

  *run() {
    for (const decl of this.ast.globals) {
      this.globals[decl.name] = decl.init ? yield* this.evalExpr(decl.init, this.globals) : 0;
    }
    if (this.ast.functions.setup) yield* this.execBlock(this.ast.functions.setup.body, this.globals);
    if (!this.ast.functions.loop) return;
    for (;;) {
      yield* this.execBlock(this.ast.functions.loop.body, this.globals);
      yield { type: "tick" };
    }
  }

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
        const value = stmt.init ? yield* this.evalExpr(stmt.init, scope) : 0;
        scope[stmt.name] = value;
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
      case "Return": return;
      default:
        throw new SimError(`Cannot execute statement of type ${stmt.type}`, stmt.line);
    }
  }

  findScope(name, scope) {
    let s = scope;
    while (s) {
      if (Object.prototype.hasOwnProperty.call(s, name)) return s;
      s = Object.getPrototypeOf(s);
    }
    return null;
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
      case "Assign": {
        const value = yield* this.evalExpr(node.value, scope);
        return this.assignTo(node.target, node.op, value, scope);
      }
      case "Update": {
        const oldVal = yield* this.evalExpr(node.expr, scope);
        const newVal = node.op === "++" ? oldVal + 1 : oldVal - 1;
        this.assignTo(node.expr, "=", newVal, scope);
        return node.prefix ? newVal : oldVal;
      }
      case "Unary": {
        const v = yield* this.evalExpr(node.expr, scope);
        if (node.op === "!") return !truthy(v);
        if (node.op === "-") return -v;
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
        const l = yield* this.evalExpr(node.left, scope);
        const r = yield* this.evalExpr(node.right, scope);
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
      case "Member": {
        // Only "Serial.xxx" is supported - treat it as a namespaced builtin name.
        if (node.object.type === "Ident") return `${node.object.name}.${node.property}`;
        throw new SimError(`Unsupported member access`, node.line);
      }
      case "Call": {
        const name = yield* this.resolveCalleeName(node.callee, scope);
        const args = [];
        for (const a of node.args) args.push(yield* this.evalExpr(a, scope));
        return yield* this.callBuiltin(name, args, node.line);
      }
      default:
        throw new SimError(`Cannot evaluate expression of type ${node.type}`, node.line);
    }
  }

  *resolveCalleeName(callee, scope) {
    if (callee.type === "Ident") return callee.name;
    if (callee.type === "Member") return yield* this.evalExpr(callee, scope);
    throw new SimError("Unsupported function call");
  }

  assignTo(target, op, value, scope) {
    if (target.type !== "Ident") throw new SimError("Left side of assignment must be a variable");
    const s = this.findScope(target.name, scope);
    if (!s) throw new SimError(`'${target.name}' was not declared before use`, target.line);
    if (op === "=") s[target.name] = value;
    else if (op === "+=") s[target.name] += value;
    else if (op === "-=") s[target.name] -= value;
    else if (op === "*=") s[target.name] *= value;
    else if (op === "/=") s[target.name] /= value;
    return s[target.name];
  }

  *callBuiltin(name, args, line) {
    const api = this.api;
    switch (name) {
      case "pinMode": api.pinMode(args[0], args[1]); return;
      case "digitalWrite": api.digitalWrite(args[0], args[1]); return;
      case "digitalRead": return api.digitalRead(args[0]);
      case "analogRead": return api.analogRead ? api.analogRead(args[0]) : 0;
      case "analogWrite": api.analogWrite && api.analogWrite(args[0], args[1]); return;
      case "delay": yield { type: "delay", ms: args[0] }; return;
      case "millis": return api.millisNow();
      case "Serial.begin": return;
      case "Serial.println": api.print(`${args[0] ?? ""}\n`); return;
      case "Serial.print": api.print(`${args[0] ?? ""}`); return;
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
}

// ---------- Runner / scheduler ----------
// Drives the generator produced by Interpreter.run(). Handles: real-time
// pacing for delay(), a periodic "yield to the browser" so a tight loop with
// no delay() can never freeze the tab, a total wall-clock time limit, and
// cooperative stopping via controller.stop().

const MAX_DELAY_MS = 1500;      // cap how long any single delay() actually waits, so demos stay snappy
const TICKS_BEFORE_YIELD = 300; // how many statements to run synchronously before giving the browser a turn
const MAX_RUN_MS = 45000;       // auto-stop safety net for runaway/infinite programs

export function startProgram(source, api, { onError, onStopped, onOutput } = {}) {
  let ast;
  try {
    ast = parse(source);
  } catch (e) {
    onError && onError(e instanceof SimError ? e.message : String(e));
    return { stop() {} };
  }
  if (!ast.functions.setup || !ast.functions.loop) {
    onError && onError("Every sketch needs both a setup() and a loop() function.");
    return { stop() {} };
  }

  let virtualMs = 0;
  const wrappedApi = {
    ...api,
    millisNow: () => virtualMs,
    print: (text) => onOutput && onOutput(text),
  };

  const interpreter = new Interpreter(ast, wrappedApi);
  const gen = interpreter.run();

  let stopped = false;
  let ticksSinceYield = 0;
  const startedAt = Date.now();

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
      onError && onError(e instanceof SimError ? e.message : String(e));
      return;
    }

    if (result.done) {
      stopped = true;
      onStopped && onStopped(null);
      return;
    }

    const value = result.value;
    if (value.type === "delay") {
      virtualMs += value.ms;
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
  };
}
