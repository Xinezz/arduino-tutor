// Mini-projects: multi-stage builds that combine several lessons' worth of
// concepts, the same "Stage 1, Stage 2..." structure described in the course
// plan. Every stage only uses functions/syntax the interpreter actually
// supports and the lessons have actually taught by the point a project
// unlocks - no forward references to things like servos or sensors that
// don't exist in this version of the simulator yet.
//
// A project "unlocks" once its `requiredLessons` are marked done, so a
// learner can't wander into a project before they have the tools to build it.

export const projects = [
  {
    id: "reaction-timer",
    icon: "⚡",
    title: "Reaction Timer Game",
    description:
      "An LED blinks while you wait, then lights up solid at a random moment - click the button as fast " +
      "as you can and see your reaction time printed in milliseconds.",
    requiredLessons: ["l2-8"],
    requiredLabel: "Complete Level 2 through \"INPUT_PULLUP\" to unlock",
    stages: [
      {
        id: "stage-1",
        title: "Stage 1: Ready Signal",
        goal:
          "Wire an LED to pin 13. Make it blink continuously (LED on, wait, LED off, wait) to show the " +
          "game is idle and waiting for a round to begin.",
        hint: "You've already built exactly this pattern in the Blink challenge back in Level 2 - reuse it.",
        exampleCode:
          "int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(300);\n  digitalWrite(ledPin, LOW);\n  delay(300);\n}",
      },
      {
        id: "stage-2",
        title: "Stage 2: Random Wait",
        goal:
          "Instead of blinking forever, wait for a random amount of time (somewhere between 1 and 3 " +
          "seconds) before doing anything else - this is the suspense before the light turns on.",
        hint:
          "random(min, max) returns a random whole number from min up to (but not including) max. Store " +
          "the result in a variable, then pass that variable to delay().",
        exampleCode: "int waitTime = random(1000, 3000);\ndelay(waitTime);",
      },
      {
        id: "stage-3",
        title: "Stage 3: Go Signal + Start the Clock",
        goal:
          "Turn the LED solidly ON (the \"go\" signal) and, at that exact moment, record the current time " +
          "using millis() so you know when the round started.",
        hint:
          "millis() returns how many milliseconds have passed since the board started running. Store that " +
          "number in a variable (unsigned long is the right type for it) right when the LED turns on.",
        exampleCode: "digitalWrite(ledPin, HIGH);\nunsigned long startTime = millis();",
      },
      {
        id: "stage-4",
        title: "Stage 4: Detect the Press and Measure",
        goal:
          "Wait until the button is pressed, then work out how much time passed since the LED turned on, " +
          "and print that number to the Serial Monitor.",
        hint:
          "A while loop that keeps checking digitalRead(buttonPin) will pause your program right there " +
          "until the condition becomes false - that's exactly \"wait until pressed\". Once it exits, " +
          "reactionTime = millis() - startTime; gives you the elapsed milliseconds.",
        exampleCode:
          "while (digitalRead(buttonPin) == HIGH) {\n  // do nothing - just wait for the press (INPUT_PULLUP wiring)\n}\nunsigned long reactionTime = millis() - startTime;\nSerial.println(reactionTime);",
      },
      {
        id: "stage-5",
        title: "Stage 5: Put It All Together",
        goal:
          "Combine everything into one continuous game: blink while idle, wait a random time, go solid " +
          "and start the clock, wait for the press, print the reaction time, then loop back and play " +
          "another round.",
        hint:
          "Your loop() function is really just stages 1-4 written out in sequence, one round per call to " +
          "loop(). Wire an LED to pin 13 and a button (INPUT_PULLUP) to pin 7 to try the full game.",
        exampleCode:
          "int ledPin = 13;\nint buttonPin = 7;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n  pinMode(buttonPin, INPUT_PULLUP);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  // idle blink while we decide the wait time\n  for (int i = 0; i < 3; i = i + 1) {\n    digitalWrite(ledPin, HIGH);\n    delay(150);\n    digitalWrite(ledPin, LOW);\n    delay(150);\n  }\n\n  int waitTime = random(1000, 3000);\n  delay(waitTime);\n\n  digitalWrite(ledPin, HIGH);\n  unsigned long startTime = millis();\n\n  while (digitalRead(buttonPin) == HIGH) {\n    // waiting for the press\n  }\n\n  unsigned long reactionTime = millis() - startTime;\n  Serial.println(reactionTime);\n  digitalWrite(ledPin, LOW);\n  delay(1000);\n}",
      },
    ],
  },

  {
    id: "security-alarm",
    icon: "🔒",
    title: "Security Alarm System",
    description:
      "Arm the system with one button, watch a status LED confirm it's armed, then trip a second " +
      "\"sensor\" button to set off a flashing alarm light and a Serial warning.",
    requiredLessons: ["l2-10"],
    requiredLabel: "Complete all of Level 2 (through the Button Counter lab) to unlock",
    stages: [
      {
        id: "stage-1",
        title: "Stage 1: Arm / Disarm Toggle",
        goal:
          "Wire a button to pin 2. Each time it's pressed, flip a true/false \"armed\" variable - like " +
          "arming a real alarm panel with one button.",
        hint:
          "This needs the same edge-detection pattern from the Button Counter challenge: remember the " +
          "previous state, and only toggle armed when you see the pin go from HIGH to LOW.",
        exampleCode:
          "bool armed = false;\nint previousState = HIGH;\nint armPin = 2;\n\nvoid loop() {\n  int currentState = digitalRead(armPin);\n  if (currentState == LOW && previousState == HIGH) {\n    armed = !armed;\n  }\n  previousState = currentState;\n}",
      },
      {
        id: "stage-2",
        title: "Stage 2: Status LED",
        goal:
          "Wire an LED to pin 13. Light it whenever armed is true, and keep it off when disarmed, so you " +
          "can see the system's status at a glance.",
        hint: "A plain if/else on the armed variable, calling digitalWrite() in each branch, is all you need.",
        exampleCode: "if (armed) {\n  digitalWrite(statusLed, HIGH);\n} else {\n  digitalWrite(statusLed, LOW);\n}",
      },
      {
        id: "stage-3",
        title: "Stage 3: Intruder Sensor",
        goal:
          "Wire a second button to pin 4 to stand in for a door sensor. While (and only while) the system " +
          "is armed, check whether this \"sensor\" has been triggered.",
        hint:
          "Nest the sensor check inside an if (armed) block - a disarmed system should ignore the sensor " +
          "completely, otherwise it would go off constantly while you're setting it up.",
        exampleCode: "if (armed && digitalRead(sensorPin) == LOW) {\n  // intruder detected!\n}",
      },
      {
        id: "stage-4",
        title: "Stage 4: Sound the Alarm",
        goal:
          "When the sensor trips while armed, rapidly blink a third LED on pin 8 (standing in for a " +
          "siren) and print a warning to the Serial Monitor.",
        hint: "A fast blink loop (a short delay, like 100ms) plus one Serial.println() call does this.",
        exampleCode:
          "digitalWrite(alarmLed, HIGH);\ndelay(100);\ndigitalWrite(alarmLed, LOW);\ndelay(100);\nSerial.println(\"INTRUDER DETECTED\");",
      },
      {
        id: "stage-5",
        title: "Stage 5: Combine Into a Full Alarm",
        goal:
          "Put it together: an arm/disarm button (pin 2), a status LED (pin 13), a sensor button (pin 4), " +
          "and an alarm LED (pin 8), all working together as one system.",
        hint:
          "Wire all four components before running this - two buttons, two LEDs, four pins total.",
        exampleCode:
          "bool armed = false;\nint previousState = HIGH;\nint armPin = 2;\nint statusLed = 13;\nint sensorPin = 4;\nint alarmLed = 8;\n\nvoid setup() {\n  pinMode(armPin, INPUT_PULLUP);\n  pinMode(sensorPin, INPUT_PULLUP);\n  pinMode(statusLed, OUTPUT);\n  pinMode(alarmLed, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int currentState = digitalRead(armPin);\n  if (currentState == LOW && previousState == HIGH) {\n    armed = !armed;\n  }\n  previousState = currentState;\n\n  if (armed) {\n    digitalWrite(statusLed, HIGH);\n  } else {\n    digitalWrite(statusLed, LOW);\n  }\n\n  if (armed && digitalRead(sensorPin) == LOW) {\n    Serial.println(\"INTRUDER DETECTED\");\n    for (int i = 0; i < 6; i = i + 1) {\n      digitalWrite(alarmLed, HIGH);\n      delay(100);\n      digitalWrite(alarmLed, LOW);\n      delay(100);\n    }\n  }\n}",
      },
    ],
  },
];

export function findProject(projectId) {
  return projects.find((p) => p.id === projectId) || null;
}
