// Level 1: Arduino Basics.
// Split into its own file (separate from level2.js) purely to keep any single
// file from becoming a huge wall of content as the course grows - data.js
// just imports both and glues them into one list.

export const level1Lessons = [
  {
    id: "l1-1",
    level: 1,
    title: "What is Arduino?",
    body: [
      { type: "p", text:
        "Arduino is two things at once: a small circuit board with a microcontroller on it, " +
        "and a simplified programming environment for writing code that runs on that board. " +
        "When people say \"an Arduino\", they usually mean the board." },
      { type: "p", text:
        "A microcontroller is a tiny computer on a single chip - it has a processor, memory, and " +
        "input/output pins, but none of the extras a laptop has (no OS, no screen, no keyboard). " +
        "It exists to do one job: run one program, over and over, forever, reading sensors and " +
        "controlling outputs like LEDs and motors." },
      { type: "note", text:
        "As a Mechatronics student, think of Arduino as the \"brain\" you bolt onto a mechanical " +
        "system so it can sense the world (buttons, sensors) and act on it (motors, LEDs, buzzers)." },
    ],
  },

  {
    id: "l1-2",
    level: 1,
    title: "Arduino Boards & Microcontrollers",
    body: [
      { type: "p", text:
        "There are many Arduino boards (Uno, Nano, Mega, Leonardo...). We'll use the Arduino Uno as " +
        "our reference board throughout this course, since it's the most common one for learning." },
      { type: "p", text:
        "The Uno's microcontroller chip is an ATmega328P. Key numbers worth knowing:" },
      { type: "code", text:
        "14 digital pins   (pins 0-13, can read/write HIGH or LOW)\n" +
        "6 analog input pins (A0-A5, can read a range of voltages)\n" +
        "6 of the digital pins support PWM  (analogWrite, marked with a ~ on the board)\n" +
        "Runs at 16 MHz, 5V logic level" },
      { type: "note", text:
        "You don't need to memorize these numbers yet - just know they exist. We'll use each of them " +
        "as we reach the relevant lesson." },
    ],
  },

  {
    id: "l1-3",
    level: 1,
    title: "The Arduino IDE",
    body: [
      { type: "p", text:
        "The Arduino IDE is the program you install on your computer to write code, check it for " +
        "errors (\"Verify\"), and send it to the board (\"Upload\")." },
      { type: "p", text:
        "This website's editor is a stand-in for the IDE while you're learning the language - it won't " +
        "upload to real hardware, but everything you write here follows the exact same rules as real " +
        "Arduino code (this is technically C++, restricted to a specific set of built-in functions)." },
      { type: "note", text:
        "Once you're comfortable with the fundamentals here, install the real Arduino IDE and try the " +
        "same programs on actual hardware - that's the real payoff." },
    ],
  },

  {
    id: "l1-4",
    level: 1,
    title: "Structure of an Arduino Program",
    body: [
      { type: "p", text:
        "Every Arduino sketch (that's what .ino files are called) needs exactly two functions: " +
        "setup() and loop(). Nothing will compile without them." },
      { type: "code", text:
        "void setup() {\n  // runs once, when the board powers on or resets\n}\n\nvoid loop() {\n  // runs over and over, forever, after setup() finishes\n}" },
      { type: "p", text:
        "If you've written C or Python before: there is no main() you write yourself, and there is no " +
        "natural end to the program - loop() just keeps calling itself for as long as the board has power." },
      { type: "note", text:
        "This is the single biggest structural difference from a normal C or Python program. Keep it in " +
        "mind - we'll come back to it a lot." },
    ],
  },

  {
    id: "l1-5",
    level: 1,
    title: "setup() in Depth",
    body: [
      { type: "p", text:
        "setup() runs exactly once. It's where you configure things before the main behaviour starts: " +
        "which pins are inputs vs outputs, starting Serial communication, initializing variables." },
      { type: "code", text:
        "void setup() {\n  pinMode(13, OUTPUT);   // configure pin 13 to send power out\n  Serial.begin(9600);   // start Serial communication at 9600 baud\n}" },
      { type: "p", text:
        "Don't worry about pinMode() or Serial.begin() yet - you'll use them properly in later lessons. " +
        "For now, just understand: setup() is your one-time preparation step." },
    ],
  },

  {
    id: "l1-6",
    level: 1,
    title: "loop() in Depth",
    body: [
      { type: "p", text:
        "loop() runs after setup(), and then runs again, and again, indefinitely - as fast as the " +
        "microcontroller can execute it (unless you slow it down with something like delay())." },
      { type: "p", text:
        "This is where your ongoing behaviour lives: reading a sensor every cycle, checking if a button " +
        "is pressed, updating an LED. Think of it as the \"heartbeat\" of your program." },
      { type: "note", text:
        "Engineering analogy: setup() is like calibrating an instrument before you start taking " +
        "measurements. loop() is the continuous measurement-and-response cycle that runs afterward." },
    ],
  },

  {
    id: "l1-7",
    level: 1,
    title: "Comments",
    body: [
      { type: "p", text:
        "Comments are text in your code that the compiler ignores completely - they exist purely for " +
        "humans reading the code (including future you)." },
      { type: "code", text:
        "// a single-line comment - everything after // on this line is ignored\n\n/* a multi-line comment\n   can span several lines\n   until it's closed */" },
      { type: "p", text:
        "This is identical to C and C++, so nothing new here if you've used either before. Good comments " +
        "explain WHY something is done a certain way, not just WHAT the line does." },
    ],
  },

  {
    id: "l1-8",
    level: 1,
    title: "Variables",
    body: [
      { type: "p", text:
        "A variable is a labelled storage location in the microcontroller's memory. Instead of writing " +
        "the number 13 everywhere in your code, you can store it in a variable called ledPin, and use " +
        "that name instead." },
      { type: "code", text:
        "int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}" },
      { type: "p", text:
        "Why bother? If you later move the LED to a different pin, you change the number in ONE place " +
        "(the variable declaration) instead of hunting through your whole program." },
      { type: "note", text:
        "Engineering analogy: think of a variable as a labelled bin on a shelf. sensorValue is a bin " +
        "that currently holds whatever number your sensor last measured. You can read what's in the bin, " +
        "or put a new value in - the label (name) stays the same." },
      { type: "p", text:
        "Unlike Python, Arduino (being C++) requires you to declare the TYPE of a variable when you " +
        "create it - more on that in the next lesson." },
    ],
    challenge: {
      id: "c2",
      title: "Use a Variable Instead of a Hardcoded Number",
      difficulty: "easy",
      prompt:
        "You're given code that hardcodes pin 13 three separate times. Rewrite it so the pin number is " +
        "stored in a single variable called ledPin, and every reference to the pin uses that variable " +
        "instead of the number 13.\n\nStarting code:\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}",
      hints: [
        "Concept hint: a variable declared outside of setup() and loop() (at the top of the file) is " +
          "visible to BOTH functions - that's exactly what you need here, since pin 13 is used in both.",
        "Function hint: declare it as int ledPin = 13; above void setup(), then replace every literal " +
          "13 with ledPin.",
        "Example hint: int buttonPin = 7; declared at the top would let you write pinMode(buttonPin, " +
          "INPUT) later - same pattern, different pin.",
      ],
      solution:
        "int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(500);\n  digitalWrite(ledPin, LOW);\n  delay(500);\n}",
      explain: [
        "int ledPin = 13; creates a variable at the top of the file, outside both functions - this is " +
          "called global scope, meaning both setup() and loop() can see and use it.",
        "Every place that used to say 13 now says ledPin - the program behaves identically, but is easier " +
          "to change later (move the LED to pin 9? change one line).",
      ],
    },
  },

  {
    id: "l1-9",
    level: 1,
    title: "Data Types",
    body: [
      { type: "p", text:
        "In Python, a variable can hold any type of value and you never declare it up front. In C++ " +
        "(and therefore Arduino), you must state the type when you declare a variable, and that " +
        "variable can only ever hold that type." },
      { type: "code", text:
        "int   count = 0;       // whole numbers, e.g. -32768 to 32767 on Uno\n" +
        "float voltage = 3.3;   // decimal numbers\n" +
        "bool  isOn = false;    // true or false only\n" +
        "char  grade = 'A';     // a single character, in single quotes\n" +
        "String label = \"Hi\";  // text, in double quotes (capital S - more on this later)" },
      { type: "p", text:
        "This matters for a concrete reason: an int uses a fixed, small amount of memory (2 bytes on " +
        "Uno), and the Uno only has 2KB of RAM total. Picking the right type isn't just style here - " +
        "it directly affects whether your program fits in memory." },
      { type: "note", text:
        "If you know C already: yes, this is exactly C's type system. The main Arduino-specific addition " +
        "is the String object (capital S) as a friendlier alternative to raw char arrays - we'll cover " +
        "the tradeoffs later." },
    ],
  },

  {
    id: "l1-10",
    level: 1,
    title: "The Serial Monitor",
    body: [
      { type: "p", text:
        "Since Arduino has no screen, the Serial Monitor is how the board \"talks back\" to you on your " +
        "computer - it's your main debugging tool for the entire course." },
      { type: "code", text:
        "void setup() {\n  Serial.begin(9600);           // open communication at 9600 bits/sec\n}\n\nvoid loop() {\n  Serial.println(\"Hello!\");   // send text, followed by a new line\n  delay(1000);                 // wait 1000 ms so it doesn't spam\n}" },
      { type: "p", text:
        "Serial.begin(9600) must be called once in setup() before you can print anything. The number " +
        "(baud rate) just needs to match between your code and whatever is reading it - 9600 is a safe " +
        "default." },
      { type: "note", text:
        "Use Serial.println() constantly while debugging: print variable values at key points in your " +
        "code so you can see what the Arduino is actually doing, not just what you assumed it was doing." },
    ],
    challenge: {
      id: "c1",
      title: "Print a Repeating Message",
      difficulty: "easy",
      prompt:
        "Write a sketch that continuously prints \"Hello Arduino\" to the Serial Monitor, once per " +
        "second. Use what you learned about setup(), loop(), Serial.begin(), Serial.println() and delay().",
      hints: [
        "Concept hint: think about which part runs once (setup) vs which part needs to repeat forever " +
          "(loop). Printing \"once per second, forever\" belongs in whichever function keeps re-running.",
        "Function hint: you'll need Serial.begin() (once, in setup), and Serial.println() + delay() " +
          "together inside loop(). delay() takes a time in milliseconds.",
        "Example hint: delay(500) pauses the program for half a second before continuing to the next " +
          "line. If you want a 1 second pause, what value would you pass instead?",
      ],
      solution:
        "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println(\"Hello Arduino\");\n  delay(1000);\n}",
      explain: [
        "Serial.begin(9600) opens the communication channel once, before loop() ever runs - this has to " +
          "happen first or nothing you print will show up.",
        "Serial.println(\"Hello Arduino\") sends the text \"Hello Arduino\" followed by a line break, so " +
          "each message appears on its own line in the monitor.",
        "delay(1000) pauses execution for 1000 milliseconds (1 second) before loop() runs again, which is " +
          "why the message appears once per second instead of as fast as possible.",
      ],
    },
  },

  {
    id: "l1-11",
    level: 1,
    title: "Constants: const and #define",
    body: [
      { type: "p", text:
        "Some values in your program should never change once set - a pin number, a threshold, a " +
        "limit. Marking these as constants documents that intent and lets the compiler catch you if " +
        "you accidentally try to change them." },
      { type: "code", text:
        "const int LED_PIN = 13;   // preferred modern style - a typed, constant variable\n" +
        "#define LED_PIN 13       // older C-style - a text find-and-replace done before compiling" },
      { type: "p", text:
        "const int is a real variable with a type, so the compiler checks it properly and gives clear " +
        "error messages. #define is a leftover from C: it just swaps the text before compiling, with no " +
        "type checking at all." },
      { type: "note", text:
        "Recommendation: use const for new code. You'll still see #define constantly in older Arduino " +
        "examples and libraries, so it's worth recognizing even if you don't write it yourself." },
    ],
  },

  {
    id: "l1-12",
    level: 1,
    title: "Arduino Uno Pinout Overview",
    body: [
      { type: "p", text:
        "Before wiring anything up, it helps to know what each group of pins on the Uno is for." },
      { type: "code", text:
        "Digital pins 0-13   general-purpose I/O, HIGH/LOW only (pins with ~ also support PWM)\n" +
        "Analog pins A0-A5    read a range of voltages (0-5V), used for sensors/potentiometers\n" +
        "5V / 3.3V            regulated power output pins, for powering small external components\n" +
        "GND                  ground - the reference \"0V\" that all your circuits connect back to\n" +
        "VIN                  where you'd feed in an external power supply (e.g. a 9V battery)" },
      { type: "note", text:
        "Pins 0 and 1 double as the Serial connection (RX/TX) used by Serial.println(). Avoid wiring " +
        "components to them while also using the Serial Monitor - they'll interfere with each other." },
    ],
  },

  {
    id: "l1-13",
    level: 1,
    title: "Power, Voltage and Current Basics",
    body: [
      { type: "p", text:
        "The Uno's logic runs at 5V - every pin, when HIGH, outputs roughly 5V; when LOW, roughly 0V. " +
        "This is important for mechatronics: mixing a 5V board with 3.3V sensors, or connecting it " +
        "directly to a 12V motor, will damage something." },
      { type: "p", text:
        "Just as important: each digital pin can only safely supply a small amount of current - about " +
        "20mA continuous, 40mA absolute maximum on the Uno. An LED alone is fine. A motor is not - it " +
        "will try to pull far more current than the pin can provide, which can permanently damage the " +
        "board." },
      { type: "note", text:
        "This is why later lessons on motors always involve a driver circuit or module in between - the " +
        "Arduino pin tells the motor driver what to do, but the driver (powered separately) supplies the " +
        "actual current. Never wire a motor straight to a digital pin." },
    ],
  },

  {
    id: "l1-14",
    level: 1,
    title: "Compiling and Uploading: What Actually Happens",
    body: [
      { type: "p", text:
        "When you click Upload in the IDE, three things happen in sequence: your C++ code is compiled " +
        "into machine code the ATmega328P chip understands, that machine code is packaged into a .hex " +
        "file, and the file is sent over USB to a small program already on the chip (the bootloader), " +
        "which writes it into the chip's flash memory." },
      { type: "p", text:
        "\"Verify\" (or \"Compile\") does just the first step - it checks your code compiles without " +
        "actually uploading anything, which is a fast way to catch typos before you're connected to " +
        "hardware." },
      { type: "note", text:
        "The flash memory holding your program survives power loss - that's why an Arduino keeps running " +
        "your last uploaded sketch every time it's powered on, with no re-uploading needed." },
    ],
  },

  {
    id: "l1-15",
    level: 1,
    title: "Reading Compiler Errors",
    body: [
      { type: "p", text:
        "Every beginner hits compiler errors constantly - that's normal, not a sign you're doing " +
        "something wrong. Learning to read them quickly is a core skill." },
      { type: "code", text:
        "void setup() {\n  pinMode(13, OUTPUT)\n}\n\n// error: expected ';' before '}' token" },
      { type: "p", text:
        "The error names the SYMPTOM (a missing semicolon) and roughly WHERE (right before the closing " +
        "brace) - but the actual mistake is usually on the line just above where it's pointing, since " +
        "the compiler only notices something's wrong once it hits the next token." },
      { type: "note", text:
        "The most common beginner mistakes, in order of how often they show up: missing semicolons, " +
        "mismatched { } braces, mismatched ( ) parentheses, and using the wrong case (Arduino is " +
        "case-sensitive - HIGH and high are not the same thing)." },
    ],
  },
];
