// Level 3: Analog Input.

export const level3Lessons = [
  {
    id: "l3-1",
    level: 3,
    title: "Analog vs Digital Signals",
    body: [
      { type: "p", text:
        "Everything in Level 2 was digital: a pin was either HIGH or LOW, on or off, 5V or 0V - nothing " +
        "in between. Most of the real world isn't like that. A room isn't just \"light\" or \"dark\" - " +
        "it has a brightness. A knob isn't just \"turned\" or \"not turned\" - it has a position." },
      { type: "p", text:
        "An analog signal can take any value across a continuous range, not just two. To let a digital " +
        "computer like the Arduino work with these in-between values, it needs a circuit that converts " +
        "a continuously-variable voltage into a number - that circuit is called an ADC (Analog-to-Digital " +
        "Converter), and the Uno has one built in." },
      { type: "note", text:
        "Engineering analogy: a digital signal is a light switch (on/off). An analog signal is a dimmer " +
        "knob (anywhere from fully off to fully on, and everywhere in between)." },
    ],
  },

  {
    id: "l3-2",
    level: 3,
    title: "analogRead() and the 0-1023 Range",
    body: [
      { type: "p", text:
        "analogRead(pin) measures the voltage on one of the Uno's dedicated analog pins (A0-A5) and " +
        "converts it into a number - not HIGH/LOW, but a whole number from 0 to 1023." },
      { type: "code", text:
        "int sensorValue = analogRead(A0);\nSerial.println(sensorValue);" },
      { type: "p", text:
        "Why 0 to 1023? The Uno's ADC has 10-bit resolution, meaning it can distinguish 2^10 = 1024 " +
        "different voltage levels (0 through 1023) across its 0-5V range. 0 means 0V, 1023 means the " +
        "full 5V, and everything else is proportional in between." },
      { type: "note", text:
        "Notice A0 is written like a name, not a number - Arduino predefines A0-A5 as constants for you " +
        "(A0 through A5 map to pin numbers 14-19 internally), so you never need to remember the raw number." },
    ],
  },

  {
    id: "l3-3",
    level: 3,
    title: "Potentiometers",
    body: [
      { type: "p", text:
        "A potentiometer (\"pot\") is a variable resistor with a knob or slider - as you turn it, it " +
        "changes the voltage at its middle pin (the wiper), anywhere between 0V and the supply voltage." },
      { type: "p", text:
        "A pot has three legs: the two outer legs connect to 5V and GND, and the middle leg (the wiper) " +
        "connects to an analog input pin. Turning the knob doesn't change a digital state - it slides the " +
        "wiper's voltage continuously between the two ends." },
      { type: "code", text:
        "int potPin = A0;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int value = analogRead(potPin);\n  Serial.println(value);\n  delay(100);\n}" },
      { type: "note", text:
        "This is the most common way to give a project \"manual input\" - volume knobs, brightness dials, " +
        "and speed controls on real devices are very often just a potentiometer feeding an ADC." },
    ],
    challenge: {
      id: "c7",
      title: "Read a Potentiometer and Print Its Value",
      difficulty: "easy",
      prompt:
        "Wire a potentiometer's wiper to A0. Write a sketch that continuously reads its value and prints " +
        "it to the Serial Monitor, about 10 times per second.",
      hints: [
        "Concept hint: this is nearly identical in structure to the very first Serial Monitor challenge - " +
          "the only thing that changes is WHAT you're reading and printing.",
        "Function hint: analogRead(A0) gives you the current value (0-1023). Serial.println() prints it. " +
          "\"10 times per second\" means a delay of how many milliseconds between prints?",
        "Example hint: analogRead(A0) returns a plain number, exactly like digitalRead() does - you can " +
          "store it in an int and print it the same way you've printed anything else.",
      ],
      solution:
        "int potPin = A0;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int value = analogRead(potPin);\n  Serial.println(value);\n  delay(100);\n}",
      explain: [
        "analogRead(potPin) measures the wiper's current voltage and converts it to a number from 0 to " +
          "1023 - turning the knob all the way one way gives 0, all the way the other gives 1023.",
        "Serial.println(value) sends that number to the Serial Monitor, one line per reading.",
        "delay(100) pauses 100ms between readings, which works out to 10 readings per second.",
      ],
    },
  },

  {
    id: "l3-4",
    level: 3,
    title: "The map() Function",
    body: [
      { type: "p", text:
        "Raw analog readings (0-1023) are rarely the range you actually want. If you're using a pot to " +
        "set a percentage, you want 0-100, not 0-1023. map() re-scales a number from one range into another." },
      { type: "code", text:
        "int raw = analogRead(A0);              // 0 to 1023\nint percent = map(raw, 0, 1023, 0, 100); // rescaled to 0 to 100\nSerial.println(percent);" },
      { type: "p", text:
        "map(value, fromLow, fromHigh, toLow, toHigh) takes a value known to be somewhere between fromLow " +
        "and fromHigh, and returns the equivalent position between toLow and toHigh." },
      { type: "note", text:
        "map() does simple proportional scaling - it does NOT clamp the result. If the input can go " +
        "slightly outside fromLow/fromHigh, the output can go outside toLow/toHigh too. Pair it with " +
        "constrain() if you need to guarantee the result stays in range." },
    ],
    challenge: {
      id: "c9",
      title: "Map a Sensor Reading to a Friendly Range",
      difficulty: "medium",
      prompt:
        "Read a potentiometer on A0 and print its value as a percentage (0-100) instead of the raw 0-1023 " +
        "reading, updating about 10 times per second.",
      hints: [
        "Concept hint: you already know how to get the raw 0-1023 reading - the new part is converting " +
          "that into a different range before printing it.",
        "Function hint: map(value, fromLow, fromHigh, toLow, toHigh) does exactly this kind of rescaling. " +
          "What are fromLow/fromHigh for a raw analogRead() value, and toLow/toHigh for a percentage?",
        "Example hint: map(raw, 0, 1023, 0, 100) turns a raw reading of 1023 into 100, and a raw reading " +
          "of 0 into 0 - everything in between scales proportionally.",
      ],
      solution:
        "int potPin = A0;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int raw = analogRead(potPin);\n  int percent = map(raw, 0, 1023, 0, 100);\n  Serial.println(percent);\n  delay(100);\n}",
      explain: [
        "analogRead(potPin) gives the raw 0-1023 reading, same as before.",
        "map(raw, 0, 1023, 0, 100) rescales that reading proportionally into the 0-100 range - the ADC's " +
          "native range in, the range you actually care about out.",
        "Everything else (Serial.println, delay) is identical to the previous challenge - only the value " +
          "being printed changed.",
      ],
    },
  },

  {
    id: "l3-5",
    level: 3,
    title: "Light Sensors (LDR)",
    body: [
      { type: "p", text:
        "An LDR (Light Dependent Resistor, also called a photoresistor) is a component whose resistance " +
        "changes with how much light hits it - lots of light means low resistance, darkness means high " +
        "resistance." },
      { type: "p", text:
        "Wired into a simple divider circuit (LDR + a fixed resistor, or in this simulator, wired directly " +
        "to an analog pin), that changing resistance becomes a changing voltage - which is exactly what " +
        "analogRead() is built to measure." },
      { type: "code", text:
        "int ldrPin = A0;\n\nvoid loop() {\n  int brightness = analogRead(ldrPin);\n  if (brightness < 300) {\n    Serial.println(\"It's dark\");\n  } else {\n    Serial.println(\"It's bright\");\n  }\n  delay(200);\n}" },
      { type: "note", text:
        "This lesson introduces the pattern behind almost every \"smart\" sensor project: read an analog " +
        "value, then use if/else (Level 5 covers this properly, but you've already used it in earlier " +
        "challenges) to decide what that value MEANS and what to do about it." },
    ],
  },

  {
    id: "l3-6",
    level: 3,
    title: "From Reading to Meaning",
    body: [
      { type: "p", text:
        "A raw sensor number by itself isn't useful - \"612\" doesn't mean anything to a person. The " +
        "real skill in working with sensors is turning a raw reading into something meaningful: a " +
        "percentage, a plain-language description, or a decision your code acts on." },
      { type: "code", text:
        "int raw = analogRead(A0);\nSerial.print(\"Raw: \");\nSerial.println(raw);\n\nint percent = map(raw, 0, 1023, 0, 100);\nSerial.print(\"As a percentage: \");\nSerial.println(percent);" },
      { type: "p", text:
        "Serial.print() (without \"ln\") prints without starting a new line afterward - useful for building " +
        "up a labeled line of output piece by piece, like \"Raw: \" followed immediately by the number." },
      { type: "note", text:
        "Get comfortable printing BOTH the raw value and a converted/labeled version while you're " +
        "developing - seeing both at once is how you'll catch mistakes in your own map() calls and " +
        "threshold values." },
    ],
    challenge: {
      id: "c8",
      title: "Light-Level Logger",
      difficulty: "medium",
      prompt:
        "Wire an LDR to A0. Print the raw reading AND a message - \"Dark\", \"Dim\", or \"Bright\" - based " +
        "on the value, about 5 times per second.",
      hints: [
        "Concept hint: you need to read the sensor, print the number, then separately decide which of " +
          "three text categories that number falls into.",
        "Function hint: analogRead() for the reading, Serial.println() for output, and a chain of if / " +
          "else if / else to pick between three categories based on two threshold values you choose.",
        "Example hint: if (value < 300) { ... } else if (value < 700) { ... } else { ... } splits the " +
          "0-1023 range into three zones - adjust the threshold numbers to taste.",
      ],
      solution:
        "int ldrPin = A0;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int value = analogRead(ldrPin);\n  Serial.println(value);\n  if (value < 300) {\n    Serial.println(\"Dark\");\n  } else if (value < 700) {\n    Serial.println(\"Dim\");\n  } else {\n    Serial.println(\"Bright\");\n  }\n  delay(200);\n}",
      explain: [
        "analogRead(ldrPin) reads the current light level as a raw 0-1023 number.",
        "The if / else if / else chain checks the value against two thresholds (300 and 700), splitting " +
          "the full range into three zones and printing a label for whichever zone it falls in.",
        "Only one branch of an if/else-if/else chain ever runs per pass through loop() - the first " +
          "condition that matches \"wins\", and the rest are skipped.",
      ],
    },
  },
];
