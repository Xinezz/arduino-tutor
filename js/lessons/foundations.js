// Lessons added in the 2.0 curriculum redesign to fill the gaps a complete
// beginner hits: what an Arduino can do, the simulator itself, the
// electronics behind every circuit (one idea per lesson), delay(), operators,
// and planning your own project. Where each one sits in the course is decided
// by curriculum.js, not by this file.
//
// Blocks follow the lesson template (see renderLesson): explanation first,
// then a demo, a worked example, a guided activity, a prediction, an
// experiment and common mistakes - only the ones that genuinely fit.

export const foundationLessons = [
  {
    id: "m0-3",
    title: "What Can Arduino Do?",
    body: [
      { type: "p", text:
        "Every Arduino project - a blinking light, a parking sensor, a robot - follows the same three steps: " +
        "sense something, decide what to do, then do it." },
      { type: "list", items: [
        "INPUTS are how the Arduino senses the world: a button being pressed, how bright the room is, how far away a wall is, the temperature.",
        "DECISIONS are your code: \"if it's dark, switch the light on\", \"each time the button is pressed, count one more\".",
        "OUTPUTS are how it acts on the world: lighting an LED, sounding a buzzer, turning a motor, showing text on a screen.",
      ] },
      { type: "example", text:
        "An automatic night light:\n" +
        "  INPUT     a light sensor measures how bright it is\n" +
        "  DECISION  is the reading below \"dark\"?\n" +
        "  OUTPUT    switch an LED on (or off)\n\n" +
        "A parking sensor:\n" +
        "  INPUT     an ultrasonic sensor measures the distance\n" +
        "  DECISION  is it closer than 10 cm?\n" +
        "  OUTPUT    beep a buzzer" },
      { type: "predict",
        question: "A plant-watering system switches a pump on when the soil is dry. Which part is the INPUT?",
        options: ["The pump", "The soil moisture sensor", "The code that checks \"is it dry?\"", "The water"],
        answer: 1,
        explain:
          "The sensor measures the soil, so it's the input. The code's \"is it dry?\" check is the decision, and " +
          "the pump is the output - it's what acts on the world." },
      { type: "note", text:
        "This course builds that pattern one piece at a time: outputs first (Module 2), then decisions " +
        "(Module 3), then inputs (Modules 4-6) - and finally projects that use all three." },
    ],
  },

  {
    id: "m0-5",
    title: "Meet the Simulator",
    body: [
      { type: "p", text:
        "You don't need any hardware for this course. Everything happens in the simulator: a virtual Arduino " +
        "Uno and breadboard on this page, controlled by real Arduino code." },
      { type: "list", items: [
        "The code editor - where you write your sketch (an Arduino program).",
        "Run and Stop - Run checks your code and starts it; Stop powers the board down.",
        "The circuit board - an Arduino Uno above a breadboard. Add parts from the list and connect them with wires.",
        "The Serial Monitor - under the board. Messages from your sketch appear here, and so do explanations of any mistakes.",
      ] },
      { type: "guided", title: "Run your first sketch", steps: [
        "Press \"Try it in the editor\" under the example below - it puts the code in the editor.",
        "Press the green Run button above the code.",
        "Look at the Serial Monitor under the board: your sketch is printing a message every second.",
        "Press Stop when you've seen enough.",
      ] },
      { type: "example", code:
        "int seconds = 0;\n\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println(\"Hello from the simulator!\");\n}\n\nvoid loop() {\n  delay(1000);\n  seconds = seconds + 1;\n  Serial.print(\"Running for \");\n  Serial.print(seconds);\n  Serial.println(\" s\");\n}" },
      { type: "p", text:
        "Don't worry about what each line means yet - Module 2 explains every one. For now, notice that the " +
        "timing is real: a second in the sketch is a second on your clock." },
      { type: "experiment", text:
        "Change the message in quotes to your own name and run it again. Then delete one of the ; at the end " +
        "of a line and press Run - see how the simulator points to the line and explains the mistake." },
      { type: "note", text:
        "The simulator is honest about its limits. Anything it can't run is reported clearly, and Check " +
        "Circuit tells you whenever a real board would need something the simulator doesn't. The Simulator " +
        "Limits button lists everything." },
      { type: "action", action: "first-circuit", label: "Build your first circuit", text:
        "Want to wire something straight away? The guided first circuit walks you through wiring an LED and " +
        "making it blink, one step at a time." },
    ],
  },

  {
    id: "m1-2",
    title: "Current",
    body: [
      { type: "p", text:
        "Current is how much electricity actually flows through a circuit - like the amount of water moving " +
        "through a pipe. It's measured in amps (A), but Arduino circuits use tiny amounts, so you'll mostly " +
        "see milliamps (mA): 1000 mA = 1 A." },
      { type: "p", text:
        "Voltage pushes, current flows - but only if there's a complete path, and how much flows depends on " +
        "what's in the way (that's resistance, the next lesson)." },
      { type: "p", text:
        "Each Arduino pin can safely supply about 20 mA, and 40 mA is the absolute maximum. An LED needs " +
        "around 10-20 mA, which is fine. A small motor can want hundreds of mA - far more than a pin can give." },
      { type: "predict",
        question: "A small motor needs about 200 mA. What happens if you connect it straight to an Arduino pin?",
        options: ["It runs fine", "The pin is asked for ten times its limit - the pin can be damaged", "It runs at half speed, safely", "Nothing at all"],
        answer: 1,
        explain:
          "A pin can only give about 20 mA. The motor tries to pull far more, which can permanently damage the " +
          "pin. That's why motors are always driven through a separate motor driver (Module 6)." },
      { type: "note", text:
        "The simulator doesn't calculate current, so nothing \"burns out\" here. Instead, Check Circuit warns " +
        "you whenever a real board would be at risk - for example an LED with no resistor." },
    ],
  },

  {
    id: "m1-3",
    title: "Resistance and Ohm's Law",
    body: [
      { type: "p", text:
        "Resistance is how much something resists the flow of current - a narrow section of pipe. It's " +
        "measured in ohms (Ω). A resistor is a part made to have an exact resistance; the coloured bands " +
        "printed on it tell you which." },
      { type: "p", text:
        "Ohm's law links all three ideas: current = voltage ÷ resistance. More resistance means less current; " +
        "more voltage means more current." },
      { type: "demo", demo: "ohms-law" },
      { type: "example", text:
        "An LED on a 5V Arduino pin, with a 220Ω resistor:\n\n" +
        "  The LED itself uses about 2V, leaving 3V across the resistor.\n" +
        "  current = 3V ÷ 220Ω = 0.0136 A = 13.6 mA\n\n" +
        "13.6 mA is bright, and safely under the pin's 20 mA limit. With no resistor there'd be almost nothing " +
        "limiting the current - enough to damage the LED and the pin." },
      { type: "predict",
        question: "You swap the 220Ω resistor for a 1000Ω (1kΩ) one. What happens to a real LED?",
        options: ["It gets brighter", "It gets dimmer - less current flows", "Nothing changes", "It burns out"],
        answer: 1,
        explain:
          "3V ÷ 1000Ω = 3 mA - about a quarter of the current, so the LED is noticeably dimmer (but still safe). " +
          "The simulator doesn't change brightness with resistor values, which is why the demo above shows it." },
      { type: "experiment", text:
        "In the demo, find the smallest resistor that keeps the current at or below 20 mA. Then try the " +
        "biggest one - would you be able to see the LED at all?" },
      { type: "mistakes", items: [
        "Leaving the resistor out: an LED limits almost nothing by itself, so far too much current flows.",
        "Using a huge resistor (10kΩ) for an LED: it's safe, but so dim you might think it's broken.",
      ] },
    ],
  },

  {
    id: "m1-4",
    title: "Ground (GND)",
    body: [
      { type: "p", text:
        "GND - ground - is the 0-volt point of a circuit. Every voltage is measured compared to it, and every " +
        "circuit's current flows back to it." },
      { type: "p", text:
        "Picture a loop: current leaves 5V (or a pin set HIGH), goes through your parts, and returns to GND. " +
        "No path back to GND means no loop - and no current at all, however good the rest of the wiring is." },
      { type: "p", text:
        "The Uno has several GND pins, all connected inside the board, so any of them works. If a project ever " +
        "uses two power sources, their GNDs must be connected together, so every part agrees what 0V is." },
      { type: "guided", title: "See GND at work", steps: [
        "Press \"Load this circuit\" below - it puts an LED circuit powered from 5V on the board.",
        "Press Run. You don't need code: the board is powered, so the LED lights.",
        "Click the grey wire from the LED to GND to delete it. The LED goes dark - the loop is broken.",
        "Press Check Circuit to see how it describes the problem, then wire the LED's − leg back to GND.",
      ] },
      { type: "circuit", label: "Load this circuit", parts: [{ key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
        wires: [["5v", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] },
      { type: "predict",
        question: "With the GND wire removed, the LED is dark. Is the 5V pin still pushing?",
        options: ["No - 5V switches off", "Yes - but with no path back to GND, no current can flow", "Only half as hard", "It pushes backwards"],
        answer: 1,
        explain:
          "5V is still there, pushing. But current can only flow round a complete loop - with the way back to " +
          "GND gone, nothing flows anywhere in the circuit." },
    ],
  },

  {
    id: "m1-6",
    title: "LEDs and Resistors",
    body: [
      { type: "p", text:
        "An LED (light-emitting diode) lights up when current flows through it - but only in one direction. " +
        "Its longer leg is + (the anode) and goes toward the power. Its shorter leg is − (the cathode) and " +
        "goes toward GND. The simulator marks them + and − under the legs." },
      { type: "p", text:
        "An LED has almost no resistance of its own. Connected straight to 5V, it would let far too much " +
        "current through and burn out in moments. A resistor in series - in the same loop - limits the " +
        "current to a safe level. 220Ω or 330Ω is the usual choice at 5V." },
      { type: "p", text:
        "The order doesn't matter: the resistor can go before the LED or after it, as long as it's in the " +
        "same loop." },
      { type: "guided", title: "Light an LED with no code", steps: [
        "Add an LED and a Resistor from the parts list under the code editor (choose one, press + Add).",
        "Wire 5V (bottom edge of the Arduino) to one leg of the resistor.",
        "Wire the resistor's other leg to the LED's + leg (the long one).",
        "Wire the LED's − leg to GND.",
        "Press Run. No code needed: the board is powered, 5V pushes current round the loop, and the LED lights.",
      ] },
      { type: "predict",
        question: "On a REAL board, you build the same circuit but forget the resistor. What happens?",
        options: ["It works fine", "The LED flashes very brightly, then burns out", "Nothing - an LED needs code to light", "It's a bit dimmer"],
        answer: 1,
        explain:
          "Without a resistor nothing limits the current, so the LED is overloaded and burns out - often " +
          "taking the pin with it. In the simulator it still lights (it doesn't calculate current), but Check " +
          "Circuit flags the missing resistor." },
      { type: "mistakes", items: [
        "The LED in backwards: + to GND. It just stays dark - turn it round.",
        "No resistor: the simulator lets it pass with a warning, a real LED won't survive.",
        "Both LED legs in the same breadboard column: they're joined, so no current goes through the LED.",
      ] },
    ],
    challenge: {
      id: "c26",
      title: "Light an LED Without Code",
      difficulty: "easy",
      prompt:
        "On the board below, light an LED using only parts and wires - no code needed. Power it from the " +
        "Arduino's 5V pin (or the + rail), with a resistor in series, and the LED's − leg to GND. Press Run to " +
        "power the board and see it light, then check your solution.",
      hints: [
        "Concept hint: current needs a complete loop - from 5V, through the resistor and the LED, back to GND.",
        "Function hint: the LED's long leg (+) faces the power side; its short leg (−) goes to GND.",
        "Example hint: three wires - 5V → resistor, resistor → LED +, LED − → GND.",
      ],
      solution:
        "// No code needed - this challenge is all wiring:\n//   5V -> resistor -> LED + (long leg)\n//   LED - (short leg) -> GND\n\nvoid setup() {\n}\n\nvoid loop() {\n}",
      explain: [
        "5V pushes current out into the circuit, as soon as the board is powered (that's what Run does here).",
        "The resistor limits the current, so a real LED wouldn't burn out.",
        "The LED's − leg on GND completes the loop - without it, nothing flows.",
      ],
    },
  },

  {
    id: "m1-7",
    title: "Polarity and Circuit Connections",
    body: [
      { type: "p", text:
        "Polarized parts only work one way round. LEDs, buzzers and the RGB LED have + and − legs (the " +
        "simulator marks them). Resistors and push buttons aren't polarized - either way round works." },
      { type: "p", text:
        "When a circuit doesn't work, check it in this order:" },
      { type: "list", items: [
        "Is every polarized part the right way round?",
        "Does the loop get all the way back to GND?",
        "Is there a resistor where one is needed?",
        "Is each leg connected where you think it is? (Check Circuit lists exactly what's connected.)",
      ] },
      { type: "guided", title: "Debug a broken circuit", steps: [
        "Press \"Load the broken circuit\" below - it puts a faulty LED circuit on the board.",
        "Press \"Try it in the editor\" under the example, then Run. The LED on pin 13 stays dark.",
        "Press Check Circuit and read what it found.",
        "Fix it: click the LED's two wires to delete them, then wire the LED the right way round.",
        "Run again - this time it lights.",
      ] },
      { type: "circuit", label: "Load the broken circuit", parts: [{ key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
        wires: [["pin-13", "r.1"], ["r.2", "led.k"], ["led.a", "gnd"]] },
      { type: "example", code:
        "void setup() {\n  pinMode(13, OUTPUT);\n  digitalWrite(13, HIGH);  // switch pin 13 on - and leave it on\n}\n\nvoid loop() {\n}" },
      { type: "p", text: "You'll learn exactly how this sketch works in Module 2. For now, it just switches pin 13 on." },
      { type: "predict",
        question: "An LED is wired backwards in an otherwise perfect circuit. What does it do?",
        options: ["Lights normally", "Lights dimly", "Stays dark - it blocks the current", "Flickers"],
        answer: 2,
        explain:
          "An LED only lets current through from + to −. Backwards, it blocks the current completely, so the " +
          "whole loop carries nothing - the LED (and everything else in that loop) stays dark." },
      { type: "mistakes", items: [
        "Assuming the code is wrong when an LED stays dark - a wiring problem never shows an error message, so check the circuit first.",
        "Moving only one wire of a backwards LED - that can join both legs to the same point.",
      ] },
    ],
    challenge: {
      id: "c27",
      title: "Fix the Broken Circuit",
      difficulty: "medium",
      prompt:
        "Load the broken circuit, then fix it so the LED on pin 13 lights: pin 13 → resistor → LED + leg, " +
        "LED − leg → GND. Use the example sketch (it switches pin 13 on), and check your solution once the " +
        "LED lights.",
      hints: [
        "Concept hint: Check Circuit tells you what's wrong - start there.",
        "Function hint: an LED's + leg goes toward the pin (through the resistor); its − leg goes to GND.",
        "Example hint: delete the two wires on the LED's legs, then wire resistor → LED + and LED − → GND.",
      ],
      solution:
        "// The sketch is the example from the lesson; the fix is in the wiring:\n//   pin 13 -> resistor -> LED + (long leg)\n//   LED - (short leg) -> GND\n\nvoid setup() {\n  pinMode(13, OUTPUT);\n  digitalWrite(13, HIGH);\n}\n\nvoid loop() {\n}",
      explain: [
        "The broken circuit had the LED backwards: its + leg on GND and its − leg toward the pin, so it blocked the current.",
        "Turning it round puts + toward pin 13 (through the resistor) and − on GND - a complete loop in the right direction.",
        "The sketch never changed: when an LED won't light, the wiring is the first thing to check.",
      ],
    },
  },

  {
    id: "m2-8",
    title: "delay(): Making Time Pass",
    body: [
      { type: "p", text:
        "The Arduino is fast - it runs millions of instructions a second. Switch an LED on and straight off " +
        "again, and it happens too quickly to see. delay() pauses the sketch, so each change lasts long " +
        "enough to notice." },
      { type: "p", text:
        "delay() counts in milliseconds (ms): 1000 ms is one second. delay(500) waits half a second; " +
        "delay(2000) waits two." },
      { type: "example", code:
        "void setup() {\n  pinMode(13, OUTPUT);\n  digitalWrite(13, HIGH);  // on...\n  delay(2000);             // ...wait 2 seconds...\n  digitalWrite(13, LOW);   // ...then off, for good\n}\n\nvoid loop() {\n}" },
      { type: "predict",
        question: "With an LED on pin 13, what does this sketch do?",
        options: ["It flashes too fast to see", "The LED is on for 2 seconds, then off for good", "2 seconds on, 2 seconds off, forever", "The LED stays on forever"],
        answer: 1,
        explain:
          "All of it is in setup(), which runs once: on, wait 2000 ms, off - and loop() is empty, so nothing " +
          "else ever happens." },
      { type: "experiment", text:
        "Load the example, wire an LED to pin 13 and run it. Then change delay(2000) to delay(500), then to " +
        "delay(5000). The timing is real - 5000 ms really is five seconds." },
      { type: "mistakes", items: [
        "Thinking in seconds: delay(2) is 2 milliseconds, not 2 seconds - far too short to see.",
        "Expecting the sketch to do something else during a delay: nothing happens until it ends. (Module 4 shows how to avoid that with millis().)",
      ] },
    ],
    challenge: {
      id: "c25",
      title: "Signal Flash",
      difficulty: "easy",
      prompt:
        "Wire an LED to pin 13. Make it flash exactly twice, like a signal: on for 1 second, off for 1 " +
        "second, on for 1 second - then stay off for good.",
      hints: [
        "Concept hint: it only happens once, so it belongs in setup() - loop() can stay empty.",
        "Function hint: on, wait, off, wait, on, wait, off - each wait is delay(1000).",
        "Example hint: digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); ... and " +
          "don't forget pinMode(13, OUTPUT) first.",
      ],
      solution:
        "void setup() {\n  pinMode(13, OUTPUT);\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n}\n\nvoid loop() {\n}",
      explain: [
        "pinMode(13, OUTPUT) lets pin 13 power the LED.",
        "Each digitalWrite() is followed by delay(1000), so every on or off lasts exactly one second.",
        "Because it's all in setup(), it happens once - after the second flash the LED stays off.",
      ],
    },
  },

  {
    id: "m3-4",
    title: "Operators and Arithmetic",
    body: [
      { type: "p", text:
        "Arduino code calculates with + (add), - (subtract), * (multiply) and / (divide). The % operator " +
        "gives the remainder of a division: 7 % 3 is 1, because 3 goes into 7 twice with 1 left over." },
      { type: "p", text:
        "Watch out for whole numbers. When both sides of / are whole numbers (int), the answer is a whole " +
        "number too - the remainder is thrown away. 7 / 2 is 3, not 3.5. Write 7.0 / 2 (or use a float " +
        "variable) to get 3.5." },
      { type: "p", text:
        "There are shortcuts for changing a variable: count += 5 means count = count + 5, count++ adds 1, " +
        "and count-- takes 1 away." },
      { type: "example", code:
        "void setup() {\n  Serial.begin(9600);\n  int apples = 7;\n  int people = 2;\n  Serial.println(apples / people);   // whole apples each\n  Serial.println(apples % people);   // apples left over\n  Serial.println(7.0 / 2);           // with decimals\n  apples += 5;\n  Serial.println(apples);\n}\n\nvoid loop() {\n}" },
      { type: "predict",
        question: "What four lines does this sketch print?",
        options: ["3.5, 1, 3.5, 12", "3, 1, 3.50, 12", "3, 0, 3.50, 12", "4, 1, 3.50, 7"],
        answer: 1,
        output: "3\n1\n3.50\n12",
        explain:
          "apples / people is int / int, so 7 / 2 drops the remainder: 3. apples % people is that remainder: 1. " +
          "7.0 / 2 has a decimal number in it, so the answer keeps its decimals - printed with two places as " +
          "3.50. Finally apples += 5 makes 7 into 12." },
      { type: "experiment", text:
        "Try changing people to 3, or apples to 20, and predict each line before you run it. Then try " +
        "Serial.println(32767 + 1); - an int can't go that high on an Uno. What happens?" },
      { type: "mistakes", items: [
        "Expecting 7 / 2 to be 3.5 - with two whole numbers it's 3.",
        "Mixing up / and %: / is how many times it fits, % is what's left over.",
        "Overflow: an int only reaches 32767 on an Uno. 300 * 200 wraps round to a negative number (the simulator warns you).",
      ] },
    ],
    challenge: {
      id: "c28",
      title: "Time Converter",
      difficulty: "medium",
      prompt:
        "Start with int totalSeconds = 3725; at the top of your sketch. In setup(), work out how many hours, " +
        "minutes and seconds that is, and print them on one line like this: 1 h 2 min 5 s\n\n" +
        "Calculate it with / and % so it would work for any number of seconds - the check tries a different " +
        "number too.",
      hints: [
        "Concept hint: an hour is 3600 seconds and a minute is 60. Whole-number division tells you how many " +
          "whole hours fit; % tells you what's left over.",
        "Function hint: hours = totalSeconds / 3600. What's left after the hours is totalSeconds % 3600 - " +
          "divide that by 60 for the minutes.",
        "Example hint: seconds = totalSeconds % 60. Print with Serial.print(hours); Serial.print(\" h \"); and " +
          "so on, finishing with Serial.println(\" s\");",
      ],
      solution:
        "int totalSeconds = 3725;\n\nvoid setup() {\n  Serial.begin(9600);\n  int hours = totalSeconds / 3600;\n  int minutes = (totalSeconds % 3600) / 60;\n  int seconds = totalSeconds % 60;\n  Serial.print(hours);\n  Serial.print(\" h \");\n  Serial.print(minutes);\n  Serial.print(\" min \");\n  Serial.print(seconds);\n  Serial.println(\" s\");\n}\n\nvoid loop() {\n}",
      explain: [
        "totalSeconds / 3600 is whole-number division, so it gives the number of complete hours: 1.",
        "totalSeconds % 3600 is what's left after those hours (125 s); dividing that by 60 gives 2 whole minutes.",
        "totalSeconds % 60 is the remainder after all the whole minutes: 5 seconds.",
      ],
    },
  },

  {
    id: "m7-3",
    title: "Plan Your Own Project",
    body: [
      { type: "p", text:
        "You've built every piece a project needs. Now it's your turn: a project of your own, from idea to " +
        "working sketch - with no step-by-step instructions. The secret is planning before you build." },
      { type: "guided", title: "Plan before you build", steps: [
        "Describe it in one sentence: \"When ___, the Arduino will ___.\"",
        "List the INPUTS (what it senses) and the OUTPUTS (what it does).",
        "Write the DECISIONS in plain words first: \"if the distance is under 20 cm, beep\".",
        "Choose a pin for each part: ~ pins (3, 5, 6, 9, 10, 11) for dimming, A0-A5 for analog sensors.",
        "Build ONE part at a time in Free Practice: wire it, test it with a tiny sketch, then add the next.",
        "Test the edge cases: exactly at the threshold, with nothing connected, held for a long time.",
      ] },
      { type: "example", text:
        "A worked plan - a \"thirsty plant\" alarm:\n\n" +
        "  Sentence   When the soil is dry, the Arduino flashes an LED and beeps.\n" +
        "  Inputs     a soil sensor on A0 (in the simulator, a potentiometer stands in for it)\n" +
        "  Outputs    an LED on pin 9, a buzzer on pin 8\n" +
        "  Decision   if the reading is below 300: flash and beep; otherwise stay quiet\n" +
        "  Build order\n" +
        "    1. print the reading, and turn the knob to see it change\n" +
        "    2. add the LED, switched by the if\n" +
        "    3. add the buzzer" },
      { type: "list", items: [
        "Idea: a reaction-time game - an LED lights at a random moment, you press a button as fast as you can.",
        "Idea: a dice roller - press a button, print a random number from 1 to 6.",
        "Idea: a temperature warning light - green when comfortable, red when too hot.",
        "Idea: a Morse code blinker - a function per letter.",
        "Idea: a servo gauge - the servo points to how bright the room is.",
      ] },
      { type: "note", text:
        "There's no automatic check for your own project - you decide when it's done. Use Check Circuit and " +
        "the Serial Monitor to test each step. The Projects tab has two bigger guided builds if you'd like " +
        "more structure first." },
      { type: "action", action: "open-practice", label: "Open Free Practice", text:
        "Free Practice has the editor, every part and the whole board - no lesson, no rules." },
    ],
  },
];
