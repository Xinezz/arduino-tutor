// What each Arduino command does, in a beginner's words - shown under the
// code editor for whichever command the cursor is on, and as a tooltip when
// you hover over one. Only commands the simulator really runs are listed
// (see BUILTINS in simulator/interpreter.js), plus the language's own
// keywords, so an explanation never describes something that won't work.

export const GLOSSARY = {
  // ---- sketch structure ----
  setup: { usage: "void setup() { ... }", text: "Runs once, when the board powers up or resets. Set pins up and start Serial here." },
  loop: { usage: "void loop() { ... }", text: "Runs over and over, forever, after setup() has finished." },
  void: { usage: "void", text: "\"Nothing\": a void function doesn't hand a value back." },
  return: { usage: "return value;", text: "Ends the function and hands the value back to whoever called it." },

  // ---- variables ----
  int: { usage: "int name = 0;", text: "A whole number. On an Uno it holds -32768 to 32767." },
  long: { usage: "long name = 0;", text: "A bigger whole number: about -2 billion to 2 billion." },
  unsigned: { usage: "unsigned long name = 0;", text: "No negative numbers, so it counts twice as high. unsigned long is the type for millis()." },
  float: { usage: "float name = 0.0;", text: "A number with a decimal point, like 3.5. Printed with 2 decimal places." },
  bool: { usage: "bool name = true;", text: "true or false - nothing else." },
  boolean: { usage: "boolean name = true;", text: "Arduino's other name for bool: true or false." },
  byte: { usage: "byte name = 0;", text: "A small whole number from 0 to 255." },
  char: { usage: "char letter = 'A';", text: "One character, in single quotes." },
  const: { usage: "const int name = 9;", text: "A value that can never change - the compiler stops you changing it by mistake." },
  String: { usage: "String text = \"hi\";", text: "A piece of text you can add to and print." },
  true: { usage: "true", text: "Yes / on / 1." },
  false: { usage: "false", text: "No / off / 0." },

  // ---- decisions and loops ----
  if: { usage: "if (condition) { ... }", text: "Runs the code in { } only when the condition is true." },
  else: { usage: "else { ... }", text: "Runs when the if's condition was false." },
  for: { usage: "for (int i = 0; i < 5; i++) { ... }", text: "Repeats a block a set number of times: start; keep going while; step." },
  while: { usage: "while (condition) { ... }", text: "Repeats a block as long as the condition stays true." },
  break: { usage: "break;", text: "Leaves the loop straight away." },
  continue: { usage: "continue;", text: "Skips the rest of this pass of the loop and starts the next one." },

  // ---- pins ----
  pinMode: { usage: "pinMode(pin, mode)", text: "Sets a pin up as OUTPUT (to power something) or INPUT / INPUT_PULLUP (to read something). Usually done in setup()." },
  digitalWrite: { usage: "digitalWrite(pin, value)", text: "Switches an OUTPUT pin HIGH (about 5V - on) or LOW (0V - off)." },
  digitalRead: { usage: "digitalRead(pin)", text: "Reads an input pin: HIGH or LOW." },
  analogRead: { usage: "analogRead(pin)", text: "Reads the voltage on A0-A5 as a number from 0 (0V) to 1023 (5V)." },
  analogWrite: { usage: "analogWrite(pin, value)", text: "PWM: 0 is off, 255 is fully on, in between dims. Only pins marked ~ (3, 5, 6, 9, 10, 11)." },
  HIGH: { usage: "HIGH", text: "On: about 5 volts (the number 1)." },
  LOW: { usage: "LOW", text: "Off: 0 volts (the number 0)." },
  OUTPUT: { usage: "OUTPUT", text: "pinMode setting: the pin powers something, like an LED." },
  INPUT: { usage: "INPUT", text: "pinMode setting: the pin reads something. Needs a resistor so it never floats." },
  INPUT_PULLUP: { usage: "INPUT_PULLUP", text: "pinMode setting: an input with a built-in resistor to 5V. Reads HIGH until a button connects it to GND (then LOW)." },
  LED_BUILTIN: { usage: "LED_BUILTIN", text: "The pin of the Uno's own small LED: pin 13." },
  A0: { usage: "A0 ... A5", text: "The analog input pins, for analogRead()." },

  // ---- time ----
  delay: { usage: "delay(milliseconds)", text: "Pauses the sketch. 1000 ms = 1 second. Nothing else happens until it ends." },
  delayMicroseconds: { usage: "delayMicroseconds(us)", text: "A very short pause, in millionths of a second." },
  millis: { usage: "millis()", text: "Milliseconds since the board started. Compare it with an earlier time to time things without delay()." },
  micros: { usage: "micros()", text: "Microseconds (millionths of a second) since the board started." },

  // ---- sound and sensors ----
  tone: { usage: "tone(pin, frequency)", text: "Plays a note on a buzzer: frequency in Hz (440 is the A above middle C)." },
  noTone: { usage: "noTone(pin)", text: "Stops the note tone() started." },
  pulseIn: { usage: "pulseIn(pin, HIGH)", text: "Waits for a pulse on a pin and returns how long it lasted, in microseconds. Used with the ultrasonic sensor." },

  // ---- maths ----
  map: { usage: "map(value, fromLow, fromHigh, toLow, toHigh)", text: "Re-scales a number from one range to another - e.g. 0-1023 to 0-255. Whole numbers only." },
  constrain: { usage: "constrain(x, low, high)", text: "Keeps x between low and high." },
  random: { usage: "random(min, max)", text: "A random whole number from min up to max - 1." },
  randomSeed: { usage: "randomSeed(seed)", text: "Starts random() from a different point, so the numbers change each run." },
  abs: { usage: "abs(x)", text: "x without its minus sign." },
  min: { usage: "min(a, b)", text: "The smaller of the two." },
  max: { usage: "max(a, b)", text: "The bigger of the two." },

  // ---- Serial ----
  Serial: { usage: "Serial", text: "The link to the Serial Monitor under the board - for printing messages." },
  "Serial.begin": { usage: "Serial.begin(9600);", text: "Starts the Serial Monitor connection. Put it in setup(), before any printing." },
  "Serial.print": { usage: "Serial.print(value);", text: "Prints text or a number to the Serial Monitor, staying on the same line." },
  "Serial.println": { usage: "Serial.println(value);", text: "Prints text or a number, then starts a new line." },
};
for (const pin of ["A1", "A2", "A3", "A4", "A5"]) GLOSSARY[pin] = GLOSSARY.A0;

// The glossary entry for the word at (or just before) column `ch` of a line
// of code, or null. "println" straight after "Serial." means Serial.println.
export function glossaryAt(lineText, ch) {
  const isWord = (c) => /[A-Za-z0-9_]/.test(c ?? "");
  let start = ch;
  if (!isWord(lineText[start]) && isWord(lineText[start - 1])) start--;
  if (!isWord(lineText[start])) return null;
  let end = start;
  while (isWord(lineText[start - 1])) start--;
  while (isWord(lineText[end + 1])) end++;
  const word = lineText.slice(start, end + 1);
  const key = lineText.slice(Math.max(0, start - 7), start) === "Serial." ? `Serial.${word}` : word;
  const entry = GLOSSARY[key];
  return entry ? { name: key, start, ...entry } : null;
}
