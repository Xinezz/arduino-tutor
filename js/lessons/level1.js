// Level 1: Arduino Basics.
// Split into its own file (separate from level2.js) purely to keep any single
// file from becoming a huge wall of content as the course grows - data.js
// just imports both and glues them into one list.

export const level1Lessons = [
  {
    id: "l1-1",
    title: "What is Arduino?",
    body: [
      { type: "p", text:
        "Arduino is a small, inexpensive circuit board that you can program to sense the world and control " +
        "things in it - lights, sounds, motors. You write a short program on a computer, send it to the board, " +
        "and from then on the board runs it by itself." },
      { type: "p", text:
        "The name covers two things: the board, and the free software you write programs with (the Arduino " +
        "IDE). When people say \"an Arduino\", they usually mean the board. An Arduino program is called a " +
        "sketch." },
      { type: "p", section: "theory", text:
        "Every Arduino board is built around one chip, the microcontroller - a tiny, simple computer (the next " +
        "lesson looks inside it). The rest of the board makes that chip easy to use: a USB socket to connect it " +
        "to your computer, a circuit that supplies it with steady power, and rows of pins - metal connection " +
        "points where wires go to parts like LEDs, buttons and sensors." },
      { type: "table", head: ["", "A laptop", "An Arduino Uno"], rows: [
        ["Runs", "many programs at once", "one program - the sketch you sent it - over and over"],
        ["Screen and keyboard", "yes", "no - it shows you things through its pins and the Serial Monitor"],
        ["Starts up in", "a minute or so", "about a second"],
        ["Connects to", "the internet, screens, USB devices", "LEDs, buttons, sensors and motors, wired straight to its pins"],
      ] },
      { type: "question",
        question: "Which is the best description of what an Arduino does?",
        options: [
          "It's a very small laptop",
          "It runs one program you write, using its pins to sense and control things",
          "It's a battery that powers electronics projects",
          "It needs the internet to run its program",
        ],
        answer: 1,
        why: [
          "A laptop runs many programs and has a screen and keyboard. An Arduino has neither - it runs just your one sketch.",
          "",
          "It needs power itself; it doesn't store or supply energy the way a battery does.",
          "It doesn't use the internet at all - once the sketch is on the board, it runs on its own.",
        ],
        explain:
          "An Arduino is a small programmable board: your sketch tells it what to sense (through its input pins) " +
          "and what to do (through its output pins), and it does exactly that, over and over." },
      { type: "p", section: "application", text:
        "Students, artists, hobbyists and engineers use Arduinos to build an idea quickly and see if it works: a " +
        "plant that waters itself, a weather station, a robot, a light that comes on when someone walks past. " +
        "Engineers often build a first working version (a prototype) with one before designing the final product." },
      { type: "exercise", kind: "independent",
        task:
          "Look around the room you're in. Find two things that a small programmable board could control. For " +
          "each one, say what it would need to sense, and what it would need to do.",
        expected:
          "Any two sensible examples - for instance: a desk lamp that switches on when it gets dark (senses " +
          "light, switches a light on), or a fan that starts when the room is hot (senses temperature, runs a " +
          "motor). If you can name what's sensed and what's done, you've got the idea; lesson 0.3 builds on it." },
      { type: "action", action: "first-circuit", label: "Build your first circuit", text:
        "Prefer to learn by doing? Build a blinking LED on the virtual Arduino first - a guided 10-minute " +
        "walkthrough, no hardware needed. These lessons will be right here when you're back." },
    ],
    summary: [
      "An Arduino is a small programmable board: you write a sketch, and the board runs it by itself.",
      "It senses and controls the world through its pins - metal connection points for wires.",
      "Unlike a laptop, it runs one program, over and over, from the moment it has power.",
    ],
  },

  {
    id: "l1-2",
    title: "What is a Microcontroller?",
    body: [
      { type: "p", text:
        "The chip in the middle of an Arduino Uno is a microcontroller: a complete, very small computer on a " +
        "single chip. Your sketch is stored inside it, and runs inside it." },
      { type: "p", section: "theory", text:
        "Inside, it has the same basic parts as any computer - just far smaller and simpler:" },
      { type: "table", head: ["Part", "What it does", "On the Uno's chip (ATmega328P)"], rows: [
        ["Processor", "Follows your sketch's instructions, one at a time", "16 million simple steps a second (16 MHz)"],
        ["Program memory (flash)", "Stores your sketch - and keeps it when the power is off", "32 KB: plenty for every sketch in this course"],
        ["Working memory (RAM)", "Holds the values your sketch is using right now - cleared when the power goes off", "2 KB: small, so huge lists of data don't fit"],
        ["Pins", "Connect the chip to the outside world", "20 your code can use"],
      ] },
      { type: "p", text:
        "That's tiny next to a laptop, which has millions of times more memory. But a microcontroller doesn't " +
        "need more: it has one job, and it starts doing it the moment it's powered, with no operating system to " +
        "load first." },
      { type: "question",
        question: "Which part of the microcontroller still has your sketch in it after the board has been unplugged overnight?",
        options: ["The processor", "The working memory (RAM)", "The program memory (flash)", "None - the sketch has to be sent again"],
        answer: 2,
        why: [
          "The processor follows instructions; it doesn't store them.",
          "RAM is cleared whenever the power goes off.",
          "",
          "That would make an Arduino useless away from a computer - the sketch is kept in flash memory.",
        ],
        explain:
          "Flash memory keeps its contents with no power, like a USB stick. That's why an Arduino starts running " +
          "its sketch again as soon as it's plugged back in." },
      { type: "p", section: "application", text:
        "Microcontrollers are in almost every electronic thing you own: a microwave, a washing machine, a TV " +
        "remote, a digital thermometer, a car (which can have dozens). Each one runs one program that reads " +
        "buttons or sensors and controls something. Learning Arduino is learning how all of them work." },
      { type: "exercise", kind: "independent",
        task:
          "Find three things at home that must contain a microcontroller. For each, name one input it reads and " +
          "one output it controls.",
        expected:
          "For example: a microwave reads its keypad (input) and runs the turntable motor and beeper (outputs); " +
          "a washing machine reads the door switch (input) and runs the drum motor (output); a TV remote reads " +
          "its buttons (input) and flashes an infrared LED (output)." },
    ],
    summary: [
      "A microcontroller is a whole computer on one chip: a processor, memory and pins.",
      "Flash memory keeps your sketch with the power off; RAM holds the values in use, and is cleared when the power goes.",
      "It runs one program for one job - which is why microcontrollers are in nearly every electronic device.",
    ],
  },

  {
    id: "l1-3",
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
    title: "Structure of an Arduino Program",
    body: [
      { type: "p", text:
        "A sketch is a list of instructions for the Arduino, written in a language based on C++. Every sketch " +
        "has the same basic shape - learn it once, and you can find your way around any Arduino program." },
      { type: "p", section: "theory", text:
        "When you press Upload in the Arduino IDE (or Run in the simulator), your sketch is first checked and " +
        "translated into the simple instructions the microcontroller understands - that's called compiling. " +
        "Then the board runs it, in a fixed order: setup() first, once; then loop(), over and over." },
      { type: "diagram", diagram: "program-flow" },
      { type: "annotated", lines: [
        ["void setup() {", "setup() starts here: the part that runs ONCE, when the board starts"],
        ["  // runs once", "a comment - a note for people; the Arduino ignores it"],
        ["}", "this } ends setup()"],
        ["", ""],
        ["void loop() {", "loop() starts here: the part that runs again and again"],
        ["  // runs forever", ""],
        ["}", "this } ends loop() - and then the Arduino starts loop() again"],
      ] },
      { type: "p", text:
        "Every sketch needs both, even if one of them is empty. The curly braces { } mark where each one starts " +
        "and ends: everything between them belongs to it. The word void means the function doesn't hand back a " +
        "result - Module 3 explains functions properly; for now, just write it exactly like this." },
      { type: "question",
        question: "The board powers on. Which part of the sketch runs first?",
        options: ["loop()", "setup()", "Whichever comes first in the file", "Both at the same time"],
        answer: 1,
        why: [
          "loop() only starts once setup() has finished.",
          "",
          "The order in the file doesn't matter - the Arduino always runs setup() first, then loop().",
          "The Arduino does one thing at a time: setup() completely, then loop().",
        ],
        explain: "setup() always runs first, once. Only when it has finished does loop() start - and it then repeats forever." },
      { type: "p", section: "application", text:
        "Every Arduino program you'll ever read - a robot, a weather station - has exactly this shape: setup() " +
        "gets the hardware ready once, and loop() does the job, forever. When you open someone else's sketch, " +
        "find those two first." },
      { type: "exercise", kind: "debug",
        task:
          "This sketch won't run. Press Try it, then Run, and read the message in the Serial Monitor. What's " +
          "wrong, and how do you fix it?",
        code: "void setup() {\n\n\nvoid loop() {\n}",
        hint: "Every { needs a matching }. Count them in setup().",
        expected:
          "The message says setup() is never closed before loop() begins. Add a } at the end of setup() (on " +
          "the empty line before void loop) - then it runs. It does nothing yet, because both parts are empty.",
        solution: "void setup() {\n}\n\nvoid loop() {\n}" },
      { type: "mistakes", items: [
        "Leaving out setup() or loop() because it's empty - both must be there.",
        "A missing }: every { needs its matching }, or the compiler can't tell where a function ends.",
        "Writing Setup() or LOOP() - names are case-sensitive: setup and loop, all lower case.",
      ] },
    ],
    summary: [
      "A sketch is compiled (checked and translated), then run: setup() once, then loop() forever.",
      "Every sketch needs both setup() and loop(), even if one is empty.",
      "Curly braces { } mark where each part starts and ends.",
    ],
  },

  {
    id: "l1-5",
    title: "setup() in Depth",
    body: [
      { type: "p", text:
        "setup() runs exactly once. It's where you configure things before the main behaviour starts: " +
        "which pins are inputs vs outputs, starting Serial communication, initializing variables." },
      { type: "p", text:
        "\"Once\" means once each time the board starts: when it's powered on, when its reset button is " +
        "pressed, or when a new sketch is uploaded. In the simulator, every press of Run starts the board " +
        "fresh - so setup() runs again." },
      { type: "example", code:
        "void setup() {\n  Serial.begin(9600);                 // start the Serial Monitor\n  Serial.println(\"setup: getting ready\");\n}\n\nvoid loop() {\n  Serial.println(\"loop: running\");\n  delay(1000);                        // wait one second\n}" },
      { type: "p", text:
        "You know Serial.println() from the last lesson. delay(1000) waits one second - it gets its own " +
        "lesson soon, in this module." },
      { type: "guided", title: "Watch setup() run once", steps: [
        "Press \"Try it in the editor\" under the example - it puts the sketch in the editor below.",
        "Press Run, and watch the Serial Monitor under the board.",
        "\"setup: getting ready\" appears once. \"loop: running\" keeps appearing, once a second.",
        "Press Stop, then Run again: the board starts fresh, so setup()'s line appears once more.",
      ] },
      { type: "predict",
        question: "You move Serial.println(\"setup: getting ready\"); out of setup() and into loop(), just above the other println. What happens?",
        options: [
          "Nothing changes",
          "\"setup: getting ready\" now appears every second, just before each \"loop: running\"",
          "The sketch won't compile",
          "\"setup: getting ready\" never appears",
        ],
        answer: 1,
        explain:
          "Everything in loop() repeats - so the line that used to run once now runs on every pass, once a " +
          "second. Where you put a line decides whether it happens once or over and over." },
      { type: "experiment", text:
        "Try that move for real and check your prediction. Then put it back in setup()." },
      { type: "p", section: "application", text:
        "In real projects, setup() is where the hardware gets ready: pins set as inputs or outputs, the Serial " +
        "Monitor started, a display cleared, a motor moved to its starting position. If something only needs " +
        "doing once, it goes here." },
      { type: "exercise", kind: "independent",
        task: "Write a sketch that prints \"Ready!\" once when it starts - and nothing after that.",
        hint: "Once means setup(). loop() still has to be there, but it can be empty.",
        expected: "\"Ready!\" appears once in the Serial Monitor, and nothing else, however long it runs.",
        solution: "void setup() {\n  Serial.begin(9600);\n  Serial.println(\"Ready!\");\n}\n\nvoid loop() {\n}" },
      { type: "mistakes", items: [
        "Putting something that should keep happening in setup() - it happens once, and never again.",
        "Leaving setup() out because it's empty: every sketch needs both setup() and loop(), even if one of them has nothing in it.",
        "Printing before Serial.begin(9600) has run - on a real board that text is lost. Start Serial at the top of setup().",
      ] },
    ],
    summary: [
      "setup() runs once, each time the board starts (power on, reset, new upload - or Run in the simulator).",
      "It's for preparation: setting pin modes, starting Serial, giving variables their first values.",
      "Anything that should keep happening belongs in loop() instead.",
    ],
  },

  {
    id: "l1-6",
    title: "loop() in Depth",
    body: [
      { type: "p", text:
        "loop() runs after setup(), and then runs again, and again, indefinitely - as fast as the " +
        "microcontroller can execute it (unless you slow it down with something like delay())." },
      { type: "p", text:
        "This is where your ongoing behaviour lives: reading a sensor every cycle, checking if a button " +
        "is pressed, updating an LED. Think of it as the \"heartbeat\" of your program." },
      { type: "example", code:
        "void setup() {\n  Serial.begin(9600);\n  Serial.println(\"Start\");\n}\n\nvoid loop() {\n  Serial.println(\"Again\");\n  delay(2000);   // wait two seconds before the next pass\n}" },
      { type: "predict",
        question: "What does the Serial Monitor show after 3 seconds?",
        options: ["Start, Again", "Start, Again, Again", "Again, Again, Again", "Start, Start, Again"],
        answer: 1,
        output: "Start\nAgain\nAgain",
        explain:
          "setup() prints \"Start\" once. Then loop() prints \"Again\" straight away, waits 2 seconds, and " +
          "starts over - printing \"Again\" a second time at the 2-second mark. The third one would come at " +
          "4 seconds." },
      { type: "guided", title: "Watch loop() repeat", steps: [
        "Press \"Try it in the editor\" under the example, then Run.",
        "Count the seconds between each \"Again\" in the Serial Monitor - it should be two.",
        "Press Stop when you've seen enough.",
      ] },
      { type: "experiment", text:
        "Change delay(2000) to delay(500) and run it: \"Again\" now comes four times as often. Then delete the " +
        "delay line completely. The messages pour out as fast as the board can print them - that's how fast " +
        "loop() really repeats. Press Stop." },
      { type: "p", section: "application", text:
        "Every project that reacts to the world lives in loop(): read a sensor, decide, act - and repeat, many " +
        "times a second, so it responds the moment something changes." },
      { type: "exercise", kind: "independent",
        task: "Write a sketch that prints \"Starting...\" once, and then \"Ping\" and \"Pong\" in turn, one line a second, forever.",
        hint: "loop() can print Ping, wait, print Pong, and wait - then it starts again.",
        expected: "\"Starting...\" once, then Ping, Pong, Ping, Pong... one line every second.",
        solution: "void setup() {\n  Serial.begin(9600);\n  Serial.println(\"Starting...\");\n}\n\nvoid loop() {\n  Serial.println(\"Ping\");\n  delay(1000);\n  Serial.println(\"Pong\");\n  delay(1000);\n}" },
      { type: "note", text:
        "Engineering analogy: setup() is like calibrating an instrument before you start taking " +
        "measurements. loop() is the continuous measurement-and-response cycle that runs afterward." },
      { type: "mistakes", items: [
        "Expecting loop() to run once - it never stops repeating while the board has power.",
        "Putting one-time preparation (like Serial.begin) in loop() - it runs again on every pass.",
        "Leaving out a delay when you want to watch each step happen - loop() can repeat thousands of times a second.",
      ] },
    ],
    summary: [
      "loop() starts as soon as setup() finishes, and repeats for as long as the board has power.",
      "Everything the board should keep doing - reading, checking, switching - goes in loop().",
      "With no delay() in it, loop() repeats as fast as the board can run it.",
    ],
  },

  {
    id: "l1-7",
    title: "Comments",
    body: [
      { type: "p", text:
        "Code is read by people as well as by the Arduino. A comment is a note in your sketch that the " +
        "Arduino completely ignores - it's there to explain the code to whoever reads it next, including you, " +
        "next week." },
      { type: "table", section: "theory", head: ["You write", "What's ignored"], rows: [
        ["// a note", "Everything from // to the end of that line"],
        ["/* a note */", "Everything between /* and */ - it can cover many lines"],
      ] },
      { type: "annotated", lines: [
        ["/* Greeter", "/* starts a block comment..."],
        ["   Says hello once. */", "...and */ ends it: everything in between is ignored"],
        ["void setup() {", ""],
        ["  Serial.begin(9600);  // start the Serial Monitor", "a comment after code: // to the end of the line"],
        ["  Serial.println(\"Hello!\");", ""],
        ["}", ""],
        ["", ""],
        ["void loop() {", ""],
        ["  // Serial.println(\"debug\");", "\"commented out\": a line switched off without deleting it"],
        ["}", ""],
      ] },
      { type: "p", text:
        "Good comments explain WHY, not WHAT. \"delay(1000); // wait 1 second\" only repeats the code. " +
        "\"delay(1000); // the sensor needs a second to warm up\" tells the reader something they couldn't see." },
      { type: "predict",
        question: "What does this print?",
        code: "void setup() {\n  Serial.begin(9600);\n  Serial.println(\"one\");\n  // Serial.println(\"two\");\n  Serial.println(\"three\");\n}\n\nvoid loop() {\n}",
        options: ["one, two, three", "one, three", "one only", "An error"],
        answer: 1,
        output: "one\nthree",
        why: [
          "The line with \"two\" starts with //, so the Arduino never sees it.",
          "",
          "Only the commented line is skipped - the code after it still runs.",
          "A comment is never an error: the Arduino just skips it.",
        ],
        explain: "// switches the whole line off, so \"two\" never prints. The lines before and after run as normal." },
      { type: "p", section: "application", text:
        "In real projects, comments record which pin each part is wired to, why a value was chosen, and what a " +
        "tricky section does. \"Commenting out\" is also a standard debugging trick: switch a suspect line off, " +
        "and see if the problem goes away." },
      { type: "exercise", kind: "modify",
        task:
          "Try the commented example: run it, then comment out the line that prints Hello! and run it again. " +
          "Finally, switch it back on.",
        expected: "With // in front of it, nothing is printed at all; remove the // and Hello! appears again." },
      { type: "mistakes", items: [
        "Opening a /* comment and never closing it with */ - everything after it becomes a comment, and the sketch breaks.",
        "Comments that repeat the code instead of explaining it.",
        "Leaving lots of old commented-out code - delete what you no longer need.",
      ] },
    ],
    summary: [
      "Comments are notes for people; the Arduino ignores them completely.",
      "// comments to the end of the line; /* ... */ comments everything in between.",
      "Good comments explain why; commenting a line out switches it off for testing.",
    ],
  },

  {
    id: "l1-8",
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
    title: "The Serial Monitor",
    body: [
      { type: "p", text:
        "An Arduino has no screen. The Serial Monitor is how your sketch shows you what it's doing: the board " +
        "sends text down the USB cable, and the Serial Monitor window displays it. In the simulator, it's the " +
        "panel under the board." },
      { type: "p", section: "theory", text:
        "\"Serial\" means the data travels one bit after another, along a single wire. Both ends have to agree " +
        "how fast: Serial.begin(9600) starts the connection at 9600 bits per second (\"baud\") - a standard " +
        "speed, and the one this course always uses. It goes once, at the start of setup()." },
      { type: "table", head: ["You write", "What appears"], rows: [
        ["Serial.print(\"Hi\");", "Hi - and the next print carries on the same line"],
        ["Serial.println(\"Hi\");", "Hi - then a new line starts"],
        ["Serial.println(42);", "42 - numbers are printed as digits"],
        ["Serial.println(\"42\");", "42 - in quotes it's text, but it looks the same"],
      ] },
      { type: "annotated", lines: [
        ["void setup() {", ""],
        ["  Serial.begin(9600);", "start the connection - once, at the top of setup()"],
        ["  Serial.println(\"Hello!\");", "print Hello! and start a new line"],
        ["}", ""],
        ["", ""],
        ["void loop() {", ""],
        ["  Serial.print(\"Still \");", "print, but stay on the same line..."],
        ["  Serial.println(\"running\");", "...then finish the line"],
        ["  delay(1000);", "wait one second (delay() gets its own lesson)"],
        ["}", ""],
      ] },
      { type: "guided", title: "Talk to the Serial Monitor", steps: [
        "Press \"Try it in the editor\" under the code above, then Run.",
        "\"Hello!\" appears once. \"Still running\" appears once a second, each time on a new line.",
        "Press Stop. Change println(\"running\") to print(\"running\") and run it again - everything runs together on one line.",
      ] },
      { type: "predict",
        question: "What does this print?",
        code: "void setup() {\n  Serial.begin(9600);\n  Serial.print(\"A\");\n  Serial.print(\"B\");\n  Serial.println(\"C\");\n  Serial.println(\"D\");\n}\n\nvoid loop() {\n}",
        options: ["A, B, C and D on four lines", "ABC on one line, then D on the next", "ABCD on one line", "Nothing - loop() is empty"],
        answer: 1,
        output: "ABC\nD",
        why: [
          "print doesn't start a new line - only println does.",
          "",
          "println(\"C\") ends the line, so D starts a new one.",
          "Everything here is in setup(), which runs once - an empty loop() doesn't stop it.",
        ],
        explain: "print adds to the current line; println adds and then ends it. So A, B and C share a line, and D gets the next." },
      { type: "p", section: "application", text:
        "Programmers use exactly this to find problems: print what the code is doing at each step, and see " +
        "what it REALLY did, not what you assumed. Later you'll print sensor readings - a light level, a " +
        "distance - to watch them change as numbers." },
      { type: "exercise", kind: "modify",
        task:
          "Change the sketch so that setup() prints a countdown - 3, 2 and 1, each on its own line - and then " +
          "loop() prints \"Go!\" every two seconds.",
        expected: "3, 2 and 1 appear once, each on its own line; then \"Go!\" appears every 2 seconds, forever.",
        solution: "void setup() {\n  Serial.begin(9600);\n  Serial.println(3);\n  Serial.println(2);\n  Serial.println(1);\n}\n\nvoid loop() {\n  Serial.println(\"Go!\");\n  delay(2000);\n}" },
      { type: "mistakes", items: [
        "Printing before Serial.begin(9600) has run - on a real board that text is lost.",
        "Using print when you meant println - everything runs together on one line.",
        "Forgetting the quotes around text: Serial.println(Hello) looks for something named Hello.",
      ] },
      { type: "note", text:
        "Use Serial.println() constantly while debugging: print values at key points in your code so you can " +
        "see what the Arduino is actually doing, not just what you assumed it was doing." },
    ],
    summary: [
      "The Serial Monitor shows text your sketch sends down the USB cable.",
      "Serial.begin(9600) once at the start of setup(); then print stays on the line, println ends it.",
      "Printing what your code is doing is the most useful debugging tool there is.",
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
    title: "Understanding the Arduino Board",
    body: [
      { type: "p", text:
        "Every part you connect goes to one of the Uno's pins, and the pins come in groups, each with its own " +
        "job. Knowing the groups means you'll always know where a wire should go." },
      { type: "diagram", diagram: "uno-board", caption: "The Arduino Uno, seen from above. The same groups of pins appear on the simulator's board." },
      { type: "table", section: "theory", head: ["Pins", "What they're for", "Used for"], rows: [
        ["Digital pins 0-13", "On or off only: your code switches them HIGH (about 5V) or LOW (0V), or reads whether they're HIGH or LOW", "LEDs, buttons, buzzers - anything on/off. Pins marked ~ can also fake in-between levels (PWM, Module 5)"],
        ["Analog in A0-A5", "Measure any voltage from 0 to 5V as a number", "Sensors whose reading changes smoothly: light, temperature, a turning knob"],
        ["5V and 3.3V", "Always on: a steady supply to power small parts", "Powering sensors and the + side of a circuit"],
        ["GND", "Ground: the 0V point every circuit returns to (it has its own lesson)", "The − side of every circuit"],
      ] },
      { type: "note", text:
        "Pins 0 and 1 are also used by the USB connection to your computer, which carries uploads and the " +
        "Serial Monitor's messages (lesson 2.2). Keep them free, and wire your parts to pins 2-13." },
      { type: "question",
        question: "An LED has to be switched on and off by your sketch. Which pin could control it?",
        options: ["5V", "GND", "Pin 9", "A pin labelled 3.3V"],
        answer: 2,
        why: [
          "5V is always on - your code can't switch it off, so the LED would just stay lit.",
          "GND is 0V all the time: it's the return path, not something you can switch.",
          "",
          "Like 5V, the 3.3V pin is a steady supply your code can't switch.",
        ],
        explain:
          "Only the digital (and analog) pins can be controlled by code. 5V, 3.3V and GND are fixed supplies - " +
          "that's exactly why circuits use them for power and the digital pins for control." },
      { type: "p", section: "application", text:
        "A typical project mixes all the groups. A night light, for example, takes its light sensor's reading " +
        "on A0, switches its LED from pin 9 (through a resistor), and connects both parts' other legs to 5V and " +
        "GND. Other Arduino boards - the smaller Nano, the bigger Mega - have the same kinds of pins, just more " +
        "or fewer of them." },
      { type: "exercise", kind: "independent",
        task:
          "Using the diagram, find: (1) the pin the Uno's own built-in LED is connected to, (2) a pin that could " +
          "read a light sensor, (3) where the − side of an LED circuit should connect. Then open Free Practice " +
          "(the Practice tab) and find the same three on the simulator's board.",
        expected: "(1) Pin 13. (2) Any of A0-A5. (3) GND - the simulator's board has GND pins next to 5V along its bottom edge." },
    ],
    summary: [
      "Digital pins 0-13 are on/off; analog pins A0-A5 measure a voltage as a number.",
      "5V, 3.3V and GND are fixed supplies your code can't switch: power and the return path.",
      "Keep pins 0 and 1 free - the USB connection uses them.",
    ],
  },

  {
    id: "l1-13",
    title: "Voltage",
    body: [
      { type: "p", text:
        "Voltage is the \"push\" that makes electricity flow - like the pressure in a water pipe. It's " +
        "measured in volts (V). An AA battery pushes with 1.5V; a USB port with 5V." },
      { type: "p", section: "theory", text:
        "A voltage is always measured between two points. \"The pin is at 5V\" means 5V compared to GND - the " +
        "0V point of the circuit (it gets its own lesson soon). A higher voltage pushes harder, so - through the " +
        "same parts - more current flows." },
      { type: "table", head: ["Source", "Voltage"], rows: [
        ["AA battery", "1.5V"],
        ["Some sensors (\"3.3V parts\")", "3.3V"],
        ["USB port, and an Arduino Uno", "5V"],
        ["A 9V battery", "9V"],
        ["Wall socket (mains)", "230V or 120V - dangerous; never connect it to an Arduino"],
      ] },
      { type: "p", text:
        "The Arduino Uno works at 5 volts. When your code sets a pin HIGH, the pin pushes out about 5V; when " +
        "it's LOW, about 0V. That's all a digital pin can do: 5V or 0V, nothing in between." },
      { type: "predict",
        question: "Your code sets a pin HIGH. What voltage does it push out?",
        options: ["About 1.5V", "About 5V", "About 9V", "It depends on what's connected"],
        answer: 1,
        why: [
          "1.5V is an AA battery. The Uno's pins work at 5V.",
          "",
          "9V is more than the Uno works with - its pins only ever give 5V or 0V.",
          "A HIGH pin always tries to give about 5V. (What's connected decides the current, not the voltage - next lesson.)",
        ],
        explain: "The Uno works at 5V, so HIGH means about 5V and LOW means about 0V." },
      { type: "p", section: "application", text:
        "Every part you buy is made for a certain voltage, and the Uno's 5V sets the rules. Most beginner parts " +
        "are made for 5V. Some sensors are 3.3V parts: give them 5V and they can be damaged - they go on the " +
        "Uno's 3.3V pin. And anything that needs more than 5V, like most motors, gets its own supply." },
      { type: "exercise", kind: "independent",
        task:
          "A sensor's label says \"3.3V only\". Which Uno pin should power it? And what could happen if you " +
          "connected it to 5V instead?",
        expected:
          "The 3.3V pin. On 5V it gets pushed harder than it was made for - it could give wrong readings, or " +
          "be permanently damaged." },
      { type: "mistakes", items: [
        "Mixing voltages: a sensor made for 3.3V can be damaged by 5V, and a 12V supply connected to a pin will destroy it. Always check what voltage a part needs before you wire it.",
        "Forgetting that a voltage is between two points: \"5V\" only means something compared to GND.",
      ] },
    ],
    summary: [
      "Voltage is the push that makes current flow, measured in volts (V) between two points.",
      "The Uno works at 5V: a HIGH pin gives about 5V, a LOW pin about 0V.",
      "Every part is made for a voltage - check it before you connect anything.",
    ],
  },

  // Added after the course launched, so its id is out of sequence - ids never
  // change (saved progress uses them); the position in this list is the order.
  {
    id: "l1-16",
    title: "Breadboards",
    body: [
      { type: "p", text:
        "A breadboard lets you build a circuit without soldering: push the legs of parts and the ends of wires " +
        "into its holes, and change things as often as you like. It's how almost every Arduino project starts." },
      { type: "p", section: "theory", text:
        "Inside it, metal strips join certain holes together. The two long rows along each edge are the power " +
        "rails: every hole in a + rail is connected, and every hole in a − rail is connected. Run a wire from " +
        "the Arduino's 5V to + and from GND to −, and the whole rail becomes 5V or GND." },
      { type: "p", text:
        "In the middle, holes are joined in short columns of 5. Two legs in the same column are connected - no " +
        "wire needed. Columns are NOT joined to their neighbours, and the trench down the middle separates the " +
        "top half from the bottom half." },
      { type: "demo", demo: "breadboard" },
      { type: "predict",
        question: "An LED's two legs are pushed into holes in the SAME 5-hole column. What happens when its circuit is powered?",
        options: ["It lights normally", "Nothing - both legs are joined, so the current bypasses the LED", "It lights very brightly", "The breadboard melts"],
        answer: 1,
        why: [
          "For it to light, current has to go IN one leg and OUT the other - here the column joins them.",
          "",
          "No current goes through the LED at all, so it can't light.",
          "Nothing that dramatic - the current just takes the strip instead of the LED.",
        ],
        explain:
          "The metal strip joins the two legs, so current takes that path instead of going through the LED. " +
          "Each leg of a part needs its own column." },
      { type: "p", section: "application", text:
        "Engineers prototype on breadboards for the same reason you will: a circuit can be tried, measured and " +
        "changed in minutes. Once it works, it's moved to a soldered board for good." },
      { type: "note", text:
        "How this simulator's board works: parts don't plug in by sitting on the breadboard - connect each leg " +
        "with a wire, to a pin or to a hole. Holes in the same column ARE connected, like a real board. And the " +
        "rails are already live as 5V and GND here; on a real breadboard, run those two wires from the Arduino " +
        "first. Check Circuit always tells you what's connected to what." },
      { type: "exercise", kind: "independent",
        task:
          "In Free Practice, build 5V → resistor → LED → GND using the breadboard: wire the resistor's free leg " +
          "to the + rail, join the resistor and the LED's + leg through one 5-hole column (each wired to a hole " +
          "in it), and wire the LED's − leg to the − rail. Press Run, then Check Circuit.",
        expected:
          "The LED lights while the board runs. Check Circuit describes a complete loop from 5V through the " +
          "resistor and LED to GND - the column you used joins the resistor to the LED." },
      { type: "mistakes", items: [
        "Both legs of a part in the same column - they're shorted together, so the part does nothing.",
        "Using a rail that isn't connected to the Arduino (on a real board, nothing is live until you wire 5V and GND to the rails).",
        "Expecting a column on the top half to connect to the one below it - the trench separates them.",
      ] },
      { type: "action", action: "first-circuit", label: "Try the guided first circuit", text:
        "See a whole breadboard circuit built step by step - and what breaking it does - in the guided first circuit." },
    ],
    summary: [
      "A breadboard holds a circuit without soldering; metal strips inside join certain holes.",
      "Each + or − rail is one long connection; the middle holes are joined in columns of 5, split by the trench.",
      "Each leg of a part needs its own column - two legs in one column are shorted together.",
    ],
  },

  {
    id: "l1-14",
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
    title: "Reading Compiler Errors",
    body: [
      { type: "p", text:
        "Before your sketch runs, the compiler checks every line. If something breaks the language's rules, " +
        "it stops and tells you what's wrong and where. Everyone gets these - reading them quickly is a skill, " +
        "not a sign you've done badly." },
      { type: "code", text:
        "void setup() {\n  pinMode(13, OUTPUT)\n}\n\n// error: expected ';' before '}' token" },
      { type: "p", section: "theory", text:
        "An error message has two useful parts: WHAT the compiler expected, and WHERE it noticed the problem. " +
        "The catch is in \"noticed\": the compiler only realises something's wrong when the next thing stops " +
        "making sense - so the real mistake is often on the line BEFORE the one it names. Above, the missing ; " +
        "is on line 2, but the compiler only notices at the } on line 3." },
      { type: "table", head: ["Mistake", "The Arduino IDE says", "Where to look"], rows: [
        ["A missing ;", "expected ';' before ...", "The end of the line above the one it names"],
        ["A missing }", "expected '}' at end of input", "Count the { and }: every { needs a }"],
        ["Wrong spelling or capitals", "'digitalwrite' was not declared in this scope", "The name: digitalWrite, exactly"],
        ["A missing quote", "missing terminating \" character", "Text needs a \" at both ends"],
      ] },
      { type: "note", text:
        "The simulator explains the same mistakes in plainer words (\"Missing ';' at the end of this line\"), " +
        "and highlights the line. The real Arduino IDE uses the shorter, more technical messages in the table - " +
        "this lesson prepares you for both." },
      { type: "guided", title: "Fix two mistakes, one at a time", broken: true,
        code: "void setup() {\n  Serial.begin(9600)\n  Serial.println(\"Ready\");\n}\n\nvoid loop() {\n  Serial.printn(\"Tick\");\n  delay(1000);\n}",
        steps: [
        "Press \"Try it in the editor\" under this sketch, then Run.",
        "Read the first error: which line, and what's missing? Fix it, and Run again.",
        "A second error appears - compilers often report one problem at a time. Read it, fix it, and Run.",
        "\"Ready\" prints once, then \"Tick\" every second.",
      ] },
      { type: "p", section: "application", text:
        "Professional programmers read compiler errors every day. The method is always the same: read the " +
        "message, go to the line it names, and check that line and the one above it." },
      { type: "exercise", kind: "debug",
        task: "Find and fix every mistake in this sketch, using the error messages to guide you.",
        code: "void setup() {\n  Serial.begin(9600);\n  Serial.println(\"Start\")\n}\n\nvoid Loop() {\n  Serial.println(\"Again\");\n  delay(1000);\n}",
        hint: "There are two: one on a line inside setup(), and one in a name - names are case-sensitive.",
        expected:
          "Add the missing ; after Serial.println(\"Start\"), and rename Loop to loop (lower case). Then \"Start\" " +
          "prints once and \"Again\" every second.",
        solution: "void setup() {\n  Serial.begin(9600);\n  Serial.println(\"Start\");\n}\n\nvoid loop() {\n  Serial.println(\"Again\");\n  delay(1000);\n}" },
      { type: "mistakes", items: [
        "Only looking at the line the error names - check the line above it too.",
        "Fixing several things at once without re-running: fix one error, run, then read the next.",
        "Thinking an error means you're bad at this - every programmer gets them, all the time.",
      ] },
    ],
    summary: [
      "The compiler checks your sketch first; an error says what it expected and where it noticed.",
      "The real mistake is often on the line before the one named - check both.",
      "Fix one error at a time, then run again.",
    ],

  },
];
