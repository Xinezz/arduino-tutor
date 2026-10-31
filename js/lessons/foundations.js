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
      { type: "table", section: "theory", head: ["Part", "Input or output?", "What it does"], rows: [
        ["Push button", "Input", "Tells the Arduino whether it's being pressed"],
        ["Light sensor", "Input", "Measures how bright it is"],
        ["Ultrasonic sensor", "Input", "Measures the distance to an object"],
        ["Temperature sensor", "Input", "Measures how warm it is"],
        ["LED", "Output", "Gives off light"],
        ["Buzzer", "Output", "Makes a sound"],
        ["Servo motor", "Output", "Turns to an angle you choose"],
      ] },
      { type: "example", section: "application", text:
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
        why: [
          "The pump acts on the world - it's the output.",
          "",
          "That's the decision: it uses the input's reading to choose what to do.",
          "The water is what the pump moves, not something the Arduino senses.",
        ],
        explain:
          "The sensor measures the soil, so it's the input. The code's \"is it dry?\" check is the decision, and " +
          "the pump is the output - it's what acts on the world." },
      { type: "exercise", kind: "independent",
        task:
          "Plan a fridge-door alarm on paper: it should beep if the door is left open too long. Write down its " +
          "input, its decision and its output.",
        hint: "What does the Arduino need to know about the door? And what counts as \"too long\"?",
        expected:
          "INPUT: something that senses whether the door is open - a switch the door presses, or a light " +
          "sensor (it's bright inside when the door opens). DECISION: has the door been open longer than, say, " +
          "30 seconds? OUTPUT: sound a buzzer. If each part of your plan is clearly one of the three, it works." },
      { type: "note", text:
        "This course builds that pattern one piece at a time: outputs first (Module 2), then decisions " +
        "(Module 3), then inputs (Modules 4-6) - and finally projects that use all three." },
    ],
    summary: [
      "Every project is inputs (sensing), decisions (your code) and outputs (acting).",
      "Buttons and sensors are inputs; LEDs, buzzers, motors and screens are outputs.",
      "Planning a project starts with naming those three parts.",
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
        "The code editor - where you write your sketch.",
        "Run and Stop - Run checks your code and starts it; Stop powers the board down.",
        "The circuit board - an Arduino Uno above a breadboard. Add parts from the list and connect them with wires.",
        "The Serial Monitor - under the board. Messages from your sketch appear here, and so do explanations of any mistakes.",
      ] },
      { type: "table", section: "theory", head: ["", "The simulator", "A real Arduino"], rows: [
        ["Your code", "Real Arduino code, checked and run in the page", "Compiled and uploaded to the chip"],
        ["Timing", "Real: a second in the sketch is a second on your clock", "The same"],
        ["Current and brightness", "Not calculated - so Check Circuit warns you wherever a real part would be at risk", "Real: too much current damages parts"],
        ["Features it can't run", "Reported clearly, never faked (the Simulator Limits button lists them)", "Everything runs"],
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
      { type: "p", section: "application", text:
        "Engineers simulate circuits and code too, before building anything - finding a mistake on screen is " +
        "faster and cheaper than finding it in hardware. But a simulator only models what it was built to " +
        "model, so the real board is always the final test. That's why this course ends with moving to a real " +
        "Arduino (Module 8)." },
      { type: "exercise", kind: "independent",
        task:
          "Without changing anything else, make the sketch say \"Running for\" every 2 seconds instead of every " +
          "second. (Look for the number that looks like it's about time.)",
        hint: "The 1000 in delay(1000) is in milliseconds: 1000 of them make one second.",
        expected:
          "Changing delay(1000) to delay(2000) makes a new line appear every 2 seconds. (The count still goes " +
          "up by 1 each time, so it now runs slower than real seconds - fine for now; you'll learn to fix that " +
          "with variables in Module 3.)" },
      { type: "action", action: "first-circuit", label: "Build your first circuit", text:
        "Want to wire something straight away? The guided first circuit walks you through wiring an LED and " +
        "making it blink, one step at a time." },
    ],
    summary: [
      "The simulator runs real Arduino code on a virtual Uno - no hardware needed.",
      "Write code in the editor, build circuits on the board, press Run, and read the Serial Monitor.",
      "It doesn't calculate current, so Check Circuit warns you where a real board would be at risk - and anything it can't run is labelled, not faked.",
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
      { type: "p", section: "theory", text:
        "Voltage pushes, current flows - but only if there's a complete path, and how much flows depends on " +
        "what's in the way (that's resistance, the next lesson). Current isn't used up as it goes round: the " +
        "same amount that leaves the 5V pin comes back into GND." },
      { type: "table", head: ["Thing", "Typical current"], rows: [
        ["An LED", "10-20 mA"],
        ["One Arduino pin - safe limit", "about 20 mA (40 mA absolute maximum)"],
        ["All the Uno's pins added together", "about 200 mA at most"],
        ["A small hobby motor", "100-500 mA - far too much for a pin"],
        ["A phone charging", "1000-2000 mA"],
      ] },
      { type: "predict",
        question: "A small motor needs about 200 mA. What happens if you connect it straight to an Arduino pin?",
        options: ["It runs fine", "The pin is asked for ten times its limit - the pin can be damaged", "It runs at half speed, safely", "Nothing at all"],
        answer: 1,
        why: [
          "A pin can only safely give about 20 mA - ten times less than the motor wants.",
          "",
          "The pin doesn't \"share\" safely - it tries to deliver what the motor pulls, and overheats.",
          "Something does happen - and it's bad for the pin.",
        ],
        explain:
          "A pin can only give about 20 mA. The motor tries to pull far more, which can permanently damage the " +
          "pin. That's why motors are always driven through a separate motor driver (Module 6)." },
      { type: "p", section: "application", text:
        "This is why every LED in this course gets a resistor (it keeps the current near 15 mA), why buzzers " +
        "and small sensors are fine on a pin, and why anything big - motors, long LED strips - gets its own " +
        "power and a driver part that the Arduino switches." },
      { type: "exercise", kind: "independent",
        task:
          "Which of these could an Arduino power straight from its pins? (a) one LED drawing 15 mA, (b) a motor " +
          "drawing 250 mA, (c) three LEDs drawing 15 mA each, each on its own pin.",
        expected:
          "(a) Yes - 15 mA is under the 20 mA limit. (b) No - it needs a motor driver and its own supply. " +
          "(c) Yes - 15 mA per pin, and 45 mA in total is well within the chip's 200 mA overall limit." },
      { type: "note", text:
        "The simulator doesn't calculate current, so nothing \"burns out\" here. Instead, Check Circuit warns " +
        "you whenever a real board would be at risk - for example an LED with no resistor." },
    ],
    summary: [
      "Current is how much electricity flows, measured in amps - Arduino circuits use milliamps (mA).",
      "It only flows round a complete path, and it isn't used up along the way.",
      "A pin can safely give about 20 mA: fine for an LED, nowhere near enough for a motor.",
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
      { type: "p", section: "theory", text:
        "Ohm's law links all three ideas: current = voltage ÷ resistance. More resistance means less current; " +
        "more voltage means more current. (Engineers write it I = V ÷ R.)" },
      { type: "table", head: ["To find", "Use", "Example"], rows: [
        ["Current", "voltage ÷ resistance", "3V ÷ 220Ω = 0.0136 A = 13.6 mA"],
        ["Resistance you need", "voltage ÷ current", "3V ÷ 0.010 A = 300Ω"],
        ["Voltage across a part", "current × resistance", "0.0136 A × 220Ω = 3V"],
      ] },
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
        why: [
          "More resistance means LESS current, not more - so less light.",
          "",
          "The current changes from 13.6 mA to 3 mA - you'd see the difference.",
          "Burning out comes from too MUCH current; a bigger resistor gives less.",
        ],
        explain:
          "3V ÷ 1000Ω = 3 mA - about a quarter of the current, so the LED is noticeably dimmer (but still safe). " +
          "The simulator doesn't change brightness with resistor values, which is why the demo above shows it." },
      { type: "p", section: "application", text:
        "Choosing a resistor for an LED is the Ohm's law calculation you'll do most: take what the LED doesn't " +
        "use (5V − about 2V = 3V), divide by the current you want, and pick the nearest standard value. " +
        "Resistors come in standard values - 220Ω, 330Ω, 1kΩ, 10kΩ and so on - not every number." },
      { type: "experiment", text:
        "In the demo, find the smallest resistor that keeps the current at or below 20 mA. Then try the " +
        "biggest one - would you be able to see the LED at all?" },
      { type: "exercise", kind: "independent",
        task:
          "A blue LED uses about 3V instead of 2V. Wired to a 5V pin through a 220Ω resistor, about how much " +
          "current flows - and is it safe for the pin?",
        hint: "First work out the voltage left for the resistor: 5V minus what the LED uses.",
        expected:
          "5V − 3V = 2V across the resistor. 2V ÷ 220Ω = 0.0091 A, about 9 mA: safe, and bright enough to see " +
          "clearly." },
      { type: "mistakes", items: [
        "Leaving the resistor out: an LED limits almost nothing by itself, so far too much current flows.",
        "Using a huge resistor (10kΩ) for an LED: it's safe, but so dim you might think it's broken.",
        "Forgetting the LED's own voltage: use 5V − 2V = 3V for the resistor, not the full 5V.",
      ] },
    ],
    summary: [
      "Resistance holds back current; it's measured in ohms (Ω). A resistor has a fixed, known resistance.",
      "Ohm's law: current = voltage ÷ resistance (I = V ÷ R).",
      "For an LED on 5V: 3V is left for the resistor, so 220Ω gives about 14 mA - bright and safe.",
    ],
  },

  {
    id: "m1-4",
    title: "Ground (GND)",
    body: [
      { type: "p", text:
        "GND - ground - is the 0-volt point of a circuit. Every voltage is measured compared to it, and every " +
        "circuit's current flows back to it." },
      { type: "p", section: "theory", text:
        "In the last lesson the loop went from 5V, through the parts, back to GND. GND is the end of that " +
        "journey: no path back to GND means no loop, and no current at all, however good the rest of the " +
        "wiring is." },
      { type: "p", text:
        "The Uno has several GND pins, all connected inside the board, so any of them works. If a project ever " +
        "uses two power sources, their GNDs must be connected together, so every part agrees what 0V is." },
      { type: "p", text:
        "The opposite mistake is just as important. A wire from 5V straight to GND, with nothing in between, " +
        "is a short circuit: there's nothing to limit the current, so as much flows as the power supply can " +
        "push. On a real board that can damage the board or your computer's USB port. Every loop needs a part " +
        "in it - an LED with its resistor, a sensor, a buzzer - never just a bare wire." },
      { type: "predict",
        question: "You wire 5V → resistor → LED, but the LED's − leg isn't connected to anything. Is the 5V pin still pushing?",
        options: ["No - 5V switches off", "Yes - but with no path back to GND, no current can flow", "Only half as hard", "It pushes backwards"],
        answer: 1,
        why: [
          "The 5V pin is always on while the board has power.",
          "",
          "The push doesn't change - there's just nowhere for current to go.",
          "Voltage doesn't reverse; the circuit simply isn't complete.",
        ],
        explain:
          "5V is still there, pushing. But current can only flow round a complete loop - with the way back to " +
          "GND missing, nothing flows anywhere in the circuit." },
      { type: "guided", title: "GND pins, and a short circuit", steps: [
        "Press \"Load this circuit\" below - an LED powered from 5V. Press Run: it lights.",
        "Press Stop. Delete the grey wire to GND, then wire the LED's − leg to the OTHER GND pin. Run again - still lit: every GND pin is the same point.",
        "Press Stop. Add a wire from 5V straight to a GND pin, and press Check Circuit: read how it describes the short circuit.",
        "Delete that wire again. (In the simulator it's safe to try - on a real board, don't.)",
      ] },
      { type: "circuit", label: "Load this circuit", parts: [{ key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
        wires: [["5v", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] },
      { type: "p", section: "application", text:
        "Every sensor, display and motor driver you'll connect has a GND pin, and it always goes to the " +
        "Arduino's GND - that shared 0V is how the Arduino and the part agree on what HIGH and LOW mean. A " +
        "missing GND wire is the single most common reason a circuit does nothing." },
      { type: "exercise", kind: "independent",
        task:
          "A motor runs from its own battery, and the Arduino switches it on through a driver part. The " +
          "driver is wired to an Arduino pin, but nothing happens. The battery's − and the Arduino's GND aren't " +
          "connected. Why might that be the problem?",
        expected:
          "The driver measures the Arduino pin's HIGH (5V) compared to its own GND. If the battery's − and the " +
          "Arduino's GND aren't joined, the two sides don't share a 0V point, so the driver may never see a " +
          "proper HIGH. Connecting the GNDs together fixes it." },
      { type: "mistakes", items: [
        "Forgetting the GND wire: the circuit looks finished, but nothing flows.",
        "A short circuit: 5V (or a pin set HIGH) wired straight to GND. Check Circuit flags it as a problem - on a real board, unplug the USB cable straight away.",
        "Two power sources whose GNDs aren't connected - the parts don't agree on what 0V is.",
      ] },
    ],
    summary: [
      "GND is the 0V point: voltages are measured from it, and every circuit's current returns to it.",
      "All the Uno's GND pins are connected; separate power sources must share a GND.",
      "5V straight to GND with nothing in between is a short circuit - dangerous on a real board.",
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
      { type: "diagram", diagram: "led-parts" },
      { type: "p", section: "theory", text:
        "An LED doesn't limit its own current. Below about 2V almost nothing flows, but once the voltage " +
        "goes a little above that, the current shoots up - so connected straight to 5V, it would let far too much " +
        "current through and burn out in moments. A resistor in series - in the same loop - limits the " +
        "current to a safe level. 220Ω or 330Ω is the usual choice at 5V." },
      { type: "p", text:
        "The order doesn't matter: the resistor can go before the LED or after it, as long as it's in the " +
        "same loop. In series, the same current flows through both." },
      { type: "question",
        question: "A circuit goes 5V → LED (long leg) … LED (short leg) → 220Ω resistor → GND. Will the LED light?",
        options: ["No - the resistor has to come before the LED", "Yes - the resistor is in the same loop, so it limits the current", "Only dimly", "No - the LED is backwards"],
        answer: 1,
        why: [
          "In a single loop the same current flows everywhere, so the resistor works on either side.",
          "",
          "It's the full, normal brightness: the current is the same as with the resistor first.",
          "The long leg faces 5V and the short leg faces GND - that's the right way round.",
        ],
        explain:
          "The resistor limits the current of the whole loop, wherever it sits in it - and the LED is the right " +
          "way round (long leg toward 5V). It lights normally." },
      { type: "p", section: "application", text:
        "LEDs are everywhere: the power light on a charger, a car's indicators, traffic lights, screens made of " +
        "millions of tiny ones. Every one has something limiting its current - in your circuits, a resistor." },
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
        why: [
          "Without a resistor, nothing limits the current - far more than the LED's 20 mA flows.",
          "",
          "It needs no code here: it's powered straight from 5V.",
          "It would be brighter, not dimmer - for a moment.",
        ],
        explain:
          "Without a resistor nothing limits the current, so the LED is overloaded and burns out - often " +
          "taking the pin with it. In the simulator it still lights (it doesn't calculate current), but Check " +
          "Circuit flags the missing resistor." },
      { type: "exercise", kind: "modify",
        task:
          "Once your LED lights, double-click the resistor to change its value to 1kΩ, and run it again. Does " +
          "the simulator's LED get dimmer? What would a real one do?",
        expected:
          "The simulator's LED looks the same - it doesn't calculate current. A real LED would be noticeably " +
          "dimmer: about 3 mA instead of 14 mA (the Ohm's law demo in lesson 1.4 shows it)." },
      { type: "mistakes", items: [
        "The LED in backwards: + to GND. It just stays dark - turn it round.",
        "No resistor: the simulator lets it pass with a warning, a real LED won't survive.",
        "Both LED legs in the same breadboard column: they're joined, so no current goes through the LED.",
      ] },
    ],
    summary: [
      "An LED only lets current through one way: long leg (+, anode) toward power, short leg (−, cathode) toward GND.",
      "It needs a resistor in series - 220Ω or 330Ω at 5V - or too much current burns it out.",
      "The resistor can go on either side of the LED, as long as it's in the same loop.",
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
      { type: "table", section: "theory", head: ["Part", "Polarized?", "How to tell which leg is which"], rows: [
        ["LED", "Yes", "Long leg +, short leg −; the flat edge of the rim is the − side"],
        ["Buzzer", "Yes", "Marked + on the body, or the longer leg is +"],
        ["RGB LED", "Yes", "Its longest leg is the shared one (− on the common-cathode kind)"],
        ["Resistor", "No", "Either way round"],
        ["Push button", "No", "Either way round"],
      ] },
      { type: "p", text:
        "When a circuit doesn't work, check it in this order:" },
      { type: "list", items: [
        "Is every polarized part the right way round?",
        "Does the loop get all the way back to GND?",
        "Is there a resistor where one is needed?",
        "Is each leg connected where you think it is? (Check Circuit lists exactly what's connected.)",
      ] },
      { type: "p", section: "application", text:
        "Engineers fix circuits the same way: a fixed checklist, starting with the most common faults. A " +
        "wiring fault never produces an error message - the code can be perfect and the LED still dark - so " +
        "checking the circuit first saves hours." },
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
        why: [
          "An LED isn't like a resistor - direction matters.",
          "There's no partial current: backwards, it blocks the current completely.",
          "",
          "Nothing makes it switch on and off - it just blocks the current.",
        ],
        explain:
          "An LED only lets current through from + to −. Backwards, it blocks the current completely, so the " +
          "whole loop carries nothing - the LED (and everything else in that loop) stays dark." },
      { type: "mistakes", items: [
        "Assuming the code is wrong when an LED stays dark - a wiring problem never shows an error message, so check the circuit first.",
        "Moving only one wire of a backwards LED - that can join both legs to the same point.",
      ] },
    ],
    summary: [
      "Polarized parts (LEDs, buzzers, RGB LEDs) only work one way round; resistors and buttons work either way.",
      "Backwards, an LED blocks the current, so the whole loop stays dark - with no error message.",
      "Debug circuits with a checklist: polarity, the path to GND, resistors, then every connection.",
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
      { type: "p", section: "application", text:
        "Timing is everywhere in real projects: how long a traffic light stays green, how long a buzzer beeps, " +
        "how often a sensor is read. Every one of them is a number of milliseconds in your code." },
      { type: "exercise", kind: "independent",
        task:
          "With an LED on pin 13: make it come on 3 seconds after the board starts, stay on for 1.5 seconds, " +
          "then go off for good.",
        hint: "All of it happens once, so it all goes in setup(). 1.5 seconds is 1500 milliseconds.",
        expected: "Nothing for 3 seconds; then the LED is on for 1.5 seconds; then it stays off.",
        solution: "void setup() {\n  pinMode(13, OUTPUT);\n  delay(3000);\n  digitalWrite(13, HIGH);\n  delay(1500);\n  digitalWrite(13, LOW);\n}\n\nvoid loop() {\n}" },
      { type: "mistakes", items: [
        "Thinking in seconds: delay(2) is 2 milliseconds, not 2 seconds - far too short to see.",
        "Expecting the sketch to do something else during a delay: nothing happens until it ends. (Module 4 shows how to avoid that with millis().)",
      ] },
    ],
    summary: [
      "delay(ms) pauses the sketch for that many milliseconds: 1000 ms is one second.",
      "Code in setup() with delays runs once; in loop(), the timing repeats.",
      "Nothing else happens during a delay - the sketch just waits.",
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

  {
    id: "m1-1",
    title: "What is Electricity?",
    body: [
      { type: "p", text:
        "Every circuit in this course runs on electricity. Before measuring it, switching it and controlling " +
        "it with code, it's worth knowing what it actually is." },
      { type: "p", section: "theory", text:
        "Everything is made of atoms, and atoms contain tiny particles called electrons, which carry a " +
        "negative electric charge. In metals - like the copper inside a wire - some electrons are only loosely " +
        "held, and can drift from atom to atom. Electricity in a circuit is exactly that: charge moving along " +
        "the wire." },
      { type: "p", text:
        "The charge doesn't move by itself. Something has to push it - a battery, or the Arduino's power " +
        "supply. Three words describe what happens, and each gets its own lesson next:" },
      { type: "list", items: [
        "Voltage - how hard the charge is pushed.",
        "Current - how much charge actually flows.",
        "Resistance - how much the circuit holds the flow back.",
      ] },
      { type: "diagram", diagram: "water-analogy", caption: "A useful picture: water in a pipe. The tank's height is the voltage, the flow is the current, and a narrow section is a resistance." },
      { type: "table", head: ["", "Conductors", "Insulators"], rows: [
        ["Let charge flow?", "Easily", "Hardly at all"],
        ["Examples", "Copper and other metals, the metal strips inside a breadboard", "Plastic, rubber, glass, dry wood, air"],
        ["In your circuits", "Wires and pins carry the current", "Wire coatings and the breadboard's plastic keep each current in its own path"],
      ] },
      { type: "note", text:
        "You'll see current drawn flowing from + to − (from 5V to GND) in every diagram. That's a convention " +
        "from before electrons were discovered - the electrons themselves drift the other way. Both describe " +
        "the same flow, and this course uses the + to − convention like everyone else." },
      { type: "question",
        question: "Why is a wire made of copper with a plastic coating?",
        options: [
          "The copper makes it bendy; the plastic makes it stronger",
          "The copper carries the current; the plastic stops it reaching anything it touches",
          "The plastic carries the current; the copper protects it",
          "Both carry current, so the wire can carry twice as much",
        ],
        answer: 1,
        why: [
          "Flexibility isn't the point - copper is chosen because it conducts very well.",
          "",
          "It's the other way round: plastic is an insulator, so it can't carry the current.",
          "Plastic is an insulator - it carries almost no current at all.",
        ],
        explain:
          "Copper is an excellent conductor, so it carries the current. The plastic coating is an insulator: it " +
          "keeps the current inside the copper, so wires can touch each other (and you) safely." },
      { type: "p", section: "application", text:
        "An Arduino and everything in this course works at 5 volts - a gentle push that's safe to touch. Mains " +
        "electricity from a wall socket pushes far harder (230V in the UK and Europe, 120V in the US) and can " +
        "kill. Arduino projects that switch mains devices use special parts to keep the two apart; never " +
        "connect mains to an Arduino." },
      { type: "exercise", kind: "independent",
        task:
          "Sort these into conductors and insulators: a coin, a rubber band, kitchen foil, a plastic ruler, the " +
          "\"lead\" of a pencil (graphite), a dry wooden spoon.",
        expected:
          "Conductors: the coin, the foil and the pencil's graphite (graphite conducts, though not as well as a " +
          "metal). Insulators: the rubber band, the plastic ruler and the dry wooden spoon." },
    ],
    summary: [
      "Electricity in a circuit is electric charge moving through a conductor, like the copper in a wire.",
      "Something has to push it: that push is voltage; the flow is current; what holds it back is resistance.",
      "Conductors (metals) carry current; insulators (plastic, rubber) keep it where it belongs.",
    ],
  },

  {
    id: "m1-5",
    title: "Open and Closed Circuits",
    body: [
      { type: "p", text:
        "Ohm's law tells you how much current flows. But there's a condition hidden in it: current only flows " +
        "at all if it has a complete path to follow." },
      { type: "p", section: "theory", text:
        "A circuit is a complete loop: from the + side of the supply (the Arduino's 5V, or a pin set HIGH), " +
        "through the parts, and back to the − side (GND). When the loop is complete it's a closed circuit, and " +
        "current flows. A gap anywhere makes it an open circuit, and no current flows anywhere in it." },
      { type: "p", text:
        "\"Anywhere\" matters. Current is the same all the way round a single loop - it isn't used up by the " +
        "parts. So a break after the LED stops the current just as surely as a break before it." },
      { type: "diagram", diagram: "circuit-loop", caption: "A closed circuit: one complete loop from 5V, through the resistor and LED, back to GND." },
      { type: "demo", demo: "open-closed" },
      { type: "predict",
        question: "In a working LED circuit, you cut the wire between the LED and GND - after the LED. What happens?",
        options: [
          "The LED stays on - the current reached it before the break",
          "The LED goes out - with a gap anywhere in the loop, no current flows at all",
          "The LED dims a little",
          "The LED flickers",
        ],
        answer: 1,
        why: [
          "Current doesn't travel \"up to\" a break and stop there - it needs the whole loop to flow at all.",
          "",
          "There's no in-between: the loop is either complete (current flows) or open (none flows).",
          "Nothing makes it flicker - the gap just stops the current, steadily.",
        ],
        explain:
          "A circuit is one loop. Break it at any point and the whole loop is open, so no current flows through " +
          "anything in it - including the LED, wherever it sits." },
      { type: "p", section: "application", text:
        "Every switch works this way: a light switch, a doorbell button, the switch inside a keyboard key - each " +
        "opens and closes a loop. And the most common reason a beginner's circuit does nothing is an unwanted " +
        "open circuit: a wire that isn't quite connected." },
      { type: "guided", title: "Open and close a circuit", steps: [
        "Press \"Load this circuit\" below - an LED and resistor powered from 5V.",
        "Press Run. No code needed: the board is powered, so the LED lights. The loop is closed.",
        "Click the red wire from 5V to delete it. The LED goes dark - the circuit is open.",
        "Press Check Circuit and read how it describes the open circuit.",
        "Wire 5V back to the resistor's free leg: click one, then the other. Closed again - the LED lights.",
      ] },
      { type: "circuit", label: "Load this circuit", parts: [{ key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
        wires: [["5v", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] },
      { type: "note", text:
        "In real life you'd open and close this loop with a switch or a push button. The simulator only uses " +
        "buttons as inputs your code reads - current doesn't flow through them to an LED - so here you open " +
        "the loop by removing a wire instead. Module 4 shows how buttons are really used with an Arduino." },
      { type: "exercise", kind: "independent",
        task:
          "With the circuit lit, make the LED go out in two different ways - without touching the LED or the " +
          "resistor themselves. Then make it light again.",
        expected:
          "Any way of opening the loop works: delete the wire from 5V, or delete the wire to GND, or delete the " +
          "wire between the resistor and the LED. Each one leaves a gap, so the LED goes dark; putting the wire " +
          "back closes the loop and it lights." },
      { type: "mistakes", items: [
        "Thinking a part \"before the break\" still works - in a single loop, a gap anywhere stops everything.",
        "A connection that only looks made: on a real breadboard, a leg that isn't pushed in fully is an open circuit.",
        "Closing the loop with nothing in it: a wire from 5V straight to GND isn't a circuit you want - it's a short circuit (next lesson).",
      ] },
    ],
    summary: [
      "A circuit is a complete loop from + (5V or a HIGH pin), through the parts, back to − (GND).",
      "Closed circuit: the loop is complete, so current flows. Open circuit: a gap anywhere, so none flows.",
      "Switches and buttons work by opening and closing the loop.",
    ],
  },

  {
    id: "m1-8",
    title: "Series and Parallel Circuits",
    body: [
      { type: "p", text:
        "Real projects have more than one part. There are two basic ways to connect several parts to the same " +
        "supply - and they behave very differently." },
      { type: "p", section: "theory", text:
        "In series, parts sit one after another in a single loop. The same current flows through every one of " +
        "them, and the supply's voltage is shared between them. Break one, and the whole loop is open." },
      { type: "p", text:
        "In parallel, each part has its own path - a branch - from + to −. Every branch gets the full voltage, " +
        "each has its own current, and the supply provides the total. Break one branch, and the others carry on." },
      { type: "diagram", diagram: "series-parallel" },
      { type: "table", head: ["", "Series", "Parallel"], rows: [
        ["Paths for the current", "One", "One per branch"],
        ["Current", "The same through every part", "Each branch has its own; the supply gives the total"],
        ["Voltage", "Shared between the parts", "Every branch gets the full voltage"],
        ["If one part is removed", "Everything stops", "The other branches keep working"],
      ] },
      { type: "demo", demo: "series-parallel" },
      { type: "question",
        question: "Two red LEDs in series from 5V, with one 220Ω resistor, light dimly. Why dimmer than one LED on its own?",
        options: [
          "The resistor gets hot and steals the light",
          "Each LED uses about 2V, leaving only 1V for the resistor - so far less current flows",
          "The second LED blocks half the current",
          "Two LEDs always split the brightness in half",
        ],
        answer: 1,
        why: [
          "The resistor does turn a little energy into heat, but that's not what makes the difference here.",
          "",
          "In series, the SAME current flows through both - neither blocks the other.",
          "It's not a fixed half: the current drops from about 14 mA to about 4.5 mA - Ohm's law explains why.",
        ],
        explain:
          "In series the voltage is shared: about 2V for each LED leaves 5 − 4 = 1V for the resistor, and " +
          "1V ÷ 220Ω is only 4.5 mA - a third of the 13.6 mA one LED gets." },
      { type: "predict",
        question: "Two LEDs, each with its own 220Ω resistor, are wired in parallel to 5V. You unplug one LED. What happens to the other?",
        options: ["It goes out too", "It stays lit, just as bright", "It gets twice as bright", "It flickers"],
        answer: 1,
        why: [
          "That's what happens in SERIES. In parallel, each branch is its own complete loop.",
          "",
          "Its branch hasn't changed - same voltage, same resistor, same current.",
          "Nothing in its branch changed, so it doesn't flicker.",
        ],
        explain:
          "Each branch is a separate loop from 5V to GND with its own resistor. Removing one branch doesn't " +
          "change the other's voltage or resistance, so it keeps its 13.6 mA." },
      { type: "p", section: "application", text:
        "The lights and sockets in a house are wired in parallel - that's why switching one lamp off doesn't " +
        "turn the others off, and why each one gets the full mains voltage. With an Arduino, each LED normally " +
        "gets its own pin and its own resistor: separate branches. Series is used on purpose too - a resistor " +
        "in series with an LED is how the resistor limits the LED's current." },
      { type: "exercise", kind: "independent",
        task:
          "Three red LEDs (about 2V each) are wired in series to 5V. Will they light? What would you change so " +
          "all three light properly?",
        hint: "Add up what the three LEDs need, and compare it with the 5V available.",
        expected:
          "Barely, if at all: three LEDs need about 6V between them, but only 5V is available - not enough push " +
          "to drive a useful current through all three. Wire them in parallel instead, each with its own " +
          "resistor (or each on its own pin), and all three light normally." },
      { type: "note", text:
        "The simulator's board doesn't simulate LEDs in series - Check Circuit reports them as not connected. " +
        "Use the demo above for how series circuits really behave, and give each LED its own path to GND on " +
        "the board." },
      { type: "mistakes", items: [
        "Putting several LEDs in series on 5V and wondering why they're dim or dark - they share the 5V.",
        "Sharing one resistor between LEDs in parallel: the LEDs won't share the current evenly. Give each LED its own resistor.",
      ] },
    ],
    summary: [
      "Series: one path - the same current through every part, the voltage shared, and one break stops everything.",
      "Parallel: a branch per part - each gets the full voltage, and the others keep working if one is removed.",
      "Arduino circuits usually give each LED its own branch: its own pin and its own resistor.",
    ],
  },
];
