// Level 6: Sensors - ultrasonic, IR/obstacle, LDR revisited, temperature,
// and turning raw sensor data into decisions.

export const level6Lessons = [
  {
    id: "l6-1",
    level: 6,
    title: "Ultrasonic Distance Sensors",
    body: [
      { type: "p", text:
        "An ultrasonic sensor (the classic module is the HC-SR04) measures distance the same way a bat " +
        "or submarine sonar does: it sends out a short burst of ultrasonic sound (above human hearing) " +
        "from its TRIG pin, then listens on its ECHO pin for that sound to bounce off something and " +
        "return." },
      { type: "p", text:
        "The time between sending and receiving tells you the distance - sound travels at a known, " +
        "roughly constant speed, so time-of-flight converts directly into distance." },
      { type: "code", text:
        "int trigPin = 6;\nint echoPin = 5;\n\nvoid setup() {\n  pinMode(trigPin, OUTPUT);\n  pinMode(echoPin, INPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  digitalWrite(trigPin, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trigPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trigPin, LOW);\n\n  long duration = pulseIn(echoPin, HIGH);\n  float distanceCm = duration / 58.0;\n  Serial.println(distanceCm);\n  delay(200);\n}" },
      { type: "note", text:
        "pulseIn(pin, value) is a new built-in function: it waits for the pin to reach the given state, " +
        "then measures (in microseconds) how long it STAYS in that state before changing again - exactly " +
        "the \"how long until the echo comes back\" measurement this sensor needs." },
    ],
    challenge: {
      id: "c15",
      title: "Ultrasonic Distance Logger",
      difficulty: "medium",
      prompt:
        "Wire an ultrasonic sensor's trig lead to pin 6 and echo lead to pin 5. Continuously print the " +
        "measured distance in centimeters, about 5 times per second.",
      hints: [
        "Concept hint: sending the trigger pulse always follows the same fixed pattern (LOW, tiny pause, " +
          "HIGH, tiny pause, LOW) - you don't need to understand WHY that exact pattern, just that it's " +
          "what tells the sensor \"take a measurement now\".",
        "Function hint: after triggering, pulseIn(echoPin, HIGH) gives you the echo's duration in " +
          "microseconds. The real-world conversion formula is distance_cm = duration / 58.0.",
        "Example hint: long duration = pulseIn(echoPin, HIGH); float distanceCm = duration / 58.0; " +
          "Serial.println(distanceCm); - three lines to go from a raw pulse to a labeled distance reading.",
      ],
      solution:
        "int trigPin = 6;\nint echoPin = 5;\n\nvoid setup() {\n  pinMode(trigPin, OUTPUT);\n  pinMode(echoPin, INPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  digitalWrite(trigPin, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trigPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trigPin, LOW);\n\n  long duration = pulseIn(echoPin, HIGH);\n  float distanceCm = duration / 58.0;\n  Serial.println(distanceCm);\n  delay(200);\n}",
      explain: [
        "The three digitalWrite/delayMicroseconds lines send a clean 10-microsecond HIGH pulse on trigPin - " +
          "the sensor's signal to send out a sound burst.",
        "pulseIn(echoPin, HIGH) pauses your code until the echo pin goes HIGH (the returning echo arrives), " +
          "then keeps measuring until it goes LOW again, returning that duration in microseconds.",
        "Dividing by 58.0 converts microseconds of round-trip time into centimeters, using the known speed " +
          "of sound - this exact formula is what real HC-SR04 tutorials use.",
      ],
    },
  },

  {
    id: "l6-2",
    level: 6,
    title: "IR / Obstacle Sensors",
    body: [
      { type: "p", text:
        "An IR (infrared) obstacle sensor shines an invisible infrared LED forward and has a matching " +
        "receiver that detects whether that light bounces back off something nearby - a simple, fast, " +
        "purely digital way to answer \"is there something in front of me?\"." },
      { type: "p", text:
        "Unlike the ultrasonic sensor (which gives you a distance, an analog-feeling measurement read " +
        "through a digital pulse), most basic IR obstacle sensors just give you a plain digital signal: " +
        "HIGH or LOW." },
      { type: "code", text:
        "int irPin = 4;\n\nvoid setup() {\n  pinMode(irPin, INPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int state = digitalRead(irPin);\n  if (state == LOW) {\n    Serial.println(\"Obstacle detected\");\n  }\n  delay(100);\n}" },
      { type: "note", text:
        "Most IR obstacle modules are active-LOW: they pull the signal pin LOW when they detect something, " +
        "and it reads HIGH when the path is clear - the opposite of what you might intuitively expect. " +
        "Always check a sensor's datasheet (or, here, its label) rather than assuming." },
    ],
  },

  {
    id: "l6-3",
    level: 6,
    title: "Automation with a Light Sensor",
    body: [
      { type: "p", text:
        "You met the LDR back in Level 3 as a raw analog reading. Now let's actually DO something with " +
        "it: instead of just printing a light level, use it to automatically control an output - the " +
        "core idea behind an automatic night light." },
      { type: "code", text:
        "int ldrPin = A0;\nint ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  int light = analogRead(ldrPin);\n  if (light < 300) {\n    digitalWrite(ledPin, HIGH);  // dark -> turn the light on\n  } else {\n    digitalWrite(ledPin, LOW);   // bright enough -> stay off\n  }\n}" },
      { type: "note", text:
        "Notice this is a complete, tiny automation system: sense -> decide -> act, running continuously. " +
        "Every \"smart\" sensor-driven project you'll ever build - from this night light to a full " +
        "industrial control system - is fundamentally this same three-step loop, just with more sensors, " +
        "more outputs, and more sophisticated decisions in the middle." },
    ],
    challenge: {
      id: "c17",
      title: "Automatic Night Light",
      difficulty: "medium",
      prompt:
        "Wire an LDR to A0 and an LED to pin 13. Turn the LED on automatically when it gets dark, and off " +
        "automatically when it's bright - a real automatic night light.",
      hints: [
        "Concept hint: you need exactly three ingredients you already have separately - reading an analog " +
          "sensor, comparing it to a threshold, and driving a digital output - combined into one loop().",
        "Function hint: analogRead() to sense, an if/else to decide, digitalWrite() to act. Pick a " +
          "threshold value (try 300 first) and adjust it while testing if it feels too sensitive or not " +
          "sensitive enough.",
        "Example hint: if (analogRead(ldrPin) < 300) { digitalWrite(ledPin, HIGH); } else { " +
          "digitalWrite(ledPin, LOW); } - the whole automation fits in one if/else block.",
      ],
      solution:
        "int ldrPin = A0;\nint ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  int light = analogRead(ldrPin);\n  if (light < 300) {\n    digitalWrite(ledPin, HIGH);\n  } else {\n    digitalWrite(ledPin, LOW);\n  }\n}",
      explain: [
        "analogRead(ldrPin) reads the current light level every pass through loop() - continuously, not " +
          "just once.",
        "The if/else compares that reading against a threshold (300): below it, treat the room as \"dark\"; " +
          "at or above it, treat it as \"bright enough\".",
        "digitalWrite() in each branch drives the LED to match the decision - since this all happens every " +
          "loop() cycle with no delay, the light responds to changing brightness almost instantly.",
      ],
    },
  },

  {
    id: "l6-4",
    level: 6,
    title: "Temperature Sensors",
    body: [
      { type: "p", text:
        "A simple analog temperature sensor (like the classic TMP36) outputs a voltage that varies " +
        "linearly with temperature - read that voltage with analogRead(), then convert it to degrees " +
        "using the sensor's known formula." },
      { type: "code", text:
        "int tempPin = A0;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int raw = analogRead(tempPin);\n  float voltage = raw / 1023.0 * 5.0;\n  float tempC = (voltage - 0.5) * 100.0;\n  Serial.println(tempC);\n  delay(300);\n}" },
      { type: "p", text:
        "Breaking that conversion down: raw / 1023.0 * 5.0 converts the raw 0-1023 ADC reading back into " +
        "an actual voltage (0-5V). Then (voltage - 0.5) * 100.0 applies the TMP36's specific formula: it " +
        "outputs 0.5V at 0°C, rising 10mV per degree." },
      { type: "note", text:
        "Every analog sensor has its OWN conversion formula from raw voltage to a real-world unit - " +
        "there's no universal one. Reading a sensor's datasheet to find its formula is a completely normal, " +
        "expected part of working with real hardware, not something you're supposed to already know." },
    ],
  },

  {
    id: "l6-5",
    level: 6,
    title: "Combining Sensors and Outputs",
    body: [
      { type: "p", text:
        "Real mechatronics projects rarely use just one sensor and one output. The obstacle detector, " +
        "night light, and parking sensor you'll build in the Projects tab all follow the same underlying " +
        "shape: read one or more sensors, apply some logic, drive one or more outputs - just scaled up." },
      { type: "code", text:
        "int trigPin = 6, echoPin = 5;\nint ledPin = 13, buzzerPin = 8;\n\nvoid loop() {\n  // ... trigger + measure distance as before ...\n  float distanceCm = duration / 58.0;\n\n  if (distanceCm < 10) {\n    digitalWrite(ledPin, HIGH);\n    tone(buzzerPin, 1000);\n  } else {\n    digitalWrite(ledPin, LOW);\n    noTone(buzzerPin);\n  }\n}" },
      { type: "note", text:
        "This is exactly the shape of a parking sensor: closer than some threshold -> warn with a light " +
        "and a sound. Try the Smart Parking Sensor boss challenge below once you've worked through the " +
        "rest of this level." },
    ],
    challenge: {
      id: "c16",
      title: "Obstacle Alert System",
      difficulty: "medium",
      prompt:
        "Wire an IR obstacle sensor to pin 4 and an LED to pin 13. Light the LED whenever the sensor " +
        "detects an obstacle, and keep it off otherwise.",
      hints: [
        "Concept hint: this follows the exact sense-decide-act pattern from the night light challenge - " +
          "only the sensor and the meaning of its reading have changed.",
        "Function hint: digitalRead() to sense (remember: most IR sensors are active-LOW, so LOW usually " +
          "means \"obstacle detected\"), an if/else to decide, digitalWrite() to act.",
        "Example hint: if (digitalRead(irPin) == LOW) { digitalWrite(ledPin, HIGH); } else { " +
          "digitalWrite(ledPin, LOW); }",
      ],
      solution:
        "int irPin = 4;\nint ledPin = 13;\n\nvoid setup() {\n  pinMode(irPin, INPUT);\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  if (digitalRead(irPin) == LOW) {\n    digitalWrite(ledPin, HIGH);\n  } else {\n    digitalWrite(ledPin, LOW);\n  }\n}",
      explain: [
        "digitalRead(irPin) checks the sensor every pass through loop().",
        "== LOW checks specifically for the \"obstacle detected\" state, since this class of sensor is " +
          "active-LOW.",
        "The if/else drives the LED to directly match the sensor's current state, giving you an instant " +
          "visual indicator with no memory of past readings needed.",
      ],
    },
  },

  {
    id: "l6-6",
    level: 6,
    title: "Challenge Lab: Smart Parking Sensor",
    body: [
      { type: "p", text:
        "This boss challenge combines everything from this level into one realistic mechatronics build: " +
        "an ultrasonic-based parking sensor that gives you both a visual and an audible warning as you " +
        "get close to an obstacle - exactly like the sensors built into real cars." },
      { type: "p", text:
        "No new functions here - just ultrasonic distance measurement, an LED, and a buzzer, combined " +
        "with the same sense-decide-act pattern you've now used several times." },
    ],
    challenge: {
      id: "c18",
      title: "💀 Smart Parking Sensor",
      difficulty: "boss",
      prompt:
        "Wire an ultrasonic sensor (trig=6, echo=5), an LED (pin 13), and a buzzer (pin 8). Build a " +
        "parking sensor with three zones: farther than 30cm, stay silent and LED off. Between 10cm and " +
        "30cm, turn the LED on. Closer than 10cm, turn the LED on AND sound the buzzer.",
      hints: [
        "Concept hint: this is the light-level-logger's three-zone if/else-if/else pattern, but driving " +
          "TWO different outputs instead of printing a label - and this time you're choosing the " +
          "thresholds based on distance, not raw sensor units.",
        "Function hint: measure distance exactly as in the distance logger challenge, then use if / else " +
          "if / else with distanceCm as the condition, calling digitalWrite() and tone()/noTone() in each " +
          "branch as appropriate.",
        "Example hint: if (distanceCm < 10) { digitalWrite(ledPin, HIGH); tone(buzzerPin, 1000); } else " +
          "if (distanceCm < 30) { digitalWrite(ledPin, HIGH); noTone(buzzerPin); } else { " +
          "digitalWrite(ledPin, LOW); noTone(buzzerPin); }",
      ],
      solution:
        "int trigPin = 6;\nint echoPin = 5;\nint ledPin = 13;\nint buzzerPin = 8;\n\nvoid setup() {\n  pinMode(trigPin, OUTPUT);\n  pinMode(echoPin, INPUT);\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(trigPin, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trigPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trigPin, LOW);\n\n  long duration = pulseIn(echoPin, HIGH);\n  float distanceCm = duration / 58.0;\n\n  if (distanceCm < 10) {\n    digitalWrite(ledPin, HIGH);\n    tone(buzzerPin, 1000);\n  } else if (distanceCm < 30) {\n    digitalWrite(ledPin, HIGH);\n    noTone(buzzerPin);\n  } else {\n    digitalWrite(ledPin, LOW);\n    noTone(buzzerPin);\n  }\n\n  delay(100);\n}",
      explain: [
        "The trigger pulse and pulseIn() measurement work exactly as in the distance logger challenge - " +
          "every loop() cycle takes a fresh reading.",
        "The if / else if / else chain checks distanceCm against two thresholds (10 and 30), so exactly " +
          "one of the three zones is active on any given loop() pass.",
        "Each zone sets BOTH outputs explicitly (LED and buzzer) rather than just the one that changed - " +
          "this matters because without an explicit noTone() in the safe zones, a buzzer triggered while " +
          "close would keep sounding even after you back away.",
      ],
    },
  },
];
