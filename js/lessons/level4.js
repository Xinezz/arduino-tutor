// Level 4: PWM and Outputs - analogWrite, LED fading, buzzers, RGB LEDs,
// servo motors, and a conceptual look at DC motors.

export const level4Lessons = [
  {
    id: "l4-1",
    level: 4,
    title: "analogWrite() and PWM Explained",
    body: [
      { type: "p", text:
        "You already know digitalWrite() only gives you HIGH (5V) or LOW (0V) - no in-between. But some " +
        "of the Uno's pins (marked with a ~ next to the number) can fake an in-between voltage using a " +
        "trick called PWM: Pulse Width Modulation." },
      { type: "p", text:
        "PWM doesn't actually produce, say, 2.5V. Instead, it switches the pin HIGH and LOW very rapidly " +
        "(about 490-980 times per second on the Uno), and varies what FRACTION of each cycle is spent " +
        "HIGH. An LED (or your eye, or a motor) can't react fast enough to see the individual flickers - " +
        "it just perceives the average, which looks and behaves like a real in-between voltage." },
      { type: "code", text:
        "analogWrite(9, 128);  // pin 9 spends about 50% of each cycle HIGH (128 is roughly half of 255)" },
      { type: "note", text:
        "analogWrite() takes a value from 0 (always LOW - 0% duty cycle) to 255 (always HIGH - 100% duty " +
          "cycle) - NOT 0-1023 like analogRead(). Reading and writing analog values use different ranges " +
          "on Arduino, which trips up a lot of beginners - keep it in mind." },
    ],
    challenge: {
      id: "c10",
      title: "Control LED Brightness with a Potentiometer",
      difficulty: "medium",
      prompt:
        "Wire a potentiometer's wiper to A0, and an LED to pin 9. Make the LED's brightness follow the " +
        "potentiometer in real time - turning the knob should smoothly dim or brighten the LED.",
      hints: [
        "Concept hint: this is two things you already know how to do, chained together - read an analog " +
          "input, then use that SAME reading to drive an analog output, every single time through loop().",
        "Function hint: analogRead() gives you 0-1023. analogWrite() expects 0-255. Those ranges don't " +
          "match - what function do you already know that rescales a number from one range into another?",
        "Example hint: int raw = analogRead(A0); int brightness = map(raw, 0, 1023, 0, 255); " +
          "analogWrite(9, brightness); - three lines, reading straight into writing.",
      ],
      solution:
        "int potPin = A0;\nint ledPin = 9;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  int raw = analogRead(potPin);\n  int brightness = map(raw, 0, 1023, 0, 255);\n  analogWrite(ledPin, brightness);\n}",
      explain: [
        "analogRead(potPin) reads the pot's current position as a 0-1023 value, every single pass through loop().",
        "map(raw, 0, 1023, 0, 255) rescales that into the 0-255 range analogWrite() expects - without this " +
          "step, a raw value like 600 would be treated as \"600\" by analogWrite(), which clips to full " +
          "brightness for anything over 255.",
        "analogWrite(ledPin, brightness) sets the LED's brightness to match, and because there's no delay() " +
          "slowing loop() down, the LED responds to the knob essentially instantly.",
      ],
    },
  },

  {
    id: "l4-2",
    level: 4,
    title: "Fading an LED",
    body: [
      { type: "p", text:
        "The classic first use of PWM: instead of an LED snapping instantly between off and full " +
        "brightness, ramp its brightness up and down smoothly." },
      { type: "code", text:
        "int ledPin = 9;\nint brightness = 0;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(ledPin, brightness);\n  brightness = brightness + 5;\n  if (brightness > 255) {\n    brightness = 0;\n  }\n  delay(30);\n}" },
      { type: "p", text:
        "This increases brightness by 5 every 30ms, wrapping back to 0 once it passes 255 - a simple " +
        "sawtooth pattern (ramps up, then snaps back down). A true fade-in-then-fade-out needs the " +
        "brightness to count both up AND down, which you'll build in the challenge." },
      { type: "note", text:
        "LEDs must be wired to a PWM-capable pin for analogWrite() to have any effect - on a real Uno " +
        "that's pins 3, 5, 6, 9, 10, and 11 (marked with ~). This simulator doesn't restrict which pins " +
        "accept analogWrite, but get in the habit of checking for the ~ mark on real hardware." },
    ],
    challenge: {
      id: "c11",
      title: "Fade an LED In and Out",
      difficulty: "medium",
      prompt:
        "Wire an LED to pin 9. Make its brightness smoothly rise from 0 to 255, then smoothly fall back " +
        "to 0, repeating forever - a genuine fade in/out, not a snap-back sawtooth.",
      hints: [
        "Concept hint: a sawtooth only counts up. To fade both directions, you need the brightness to " +
          "count up until it hits the top, then start counting down until it hits the bottom, then count " +
          "up again - a direction that flips.",
        "Function hint: keep a variable for the current brightness AND a variable for the current step " +
          "direction (+1 or -1, or +5 or -5). When brightness hits 255, flip the direction to negative; " +
          "when it hits 0, flip it back to positive.",
        "Example hint: if (brightness >= 255) { step = -5; } else if (brightness <= 0) { step = 5; } " +
          "brightness = brightness + step; - check the bounds BEFORE applying the step each time through loop().",
      ],
      solution:
        "int ledPin = 9;\nint brightness = 0;\nint step = 5;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(ledPin, brightness);\n\n  if (brightness >= 255) {\n    step = -5;\n  } else if (brightness <= 0) {\n    step = 5;\n  }\n  brightness = brightness + step;\n\n  delay(30);\n}",
      explain: [
        "step holds the current direction and size of each change - positive while rising, negative while falling.",
        "The if / else if checks whether brightness has hit either end (255 or 0) and flips step's sign " +
          "accordingly - this is what turns a one-way ramp into a back-and-forth fade.",
        "brightness = brightness + step; applies that direction every single time through loop(), so the " +
          "value smoothly climbs, reverses, falls, reverses again, forever.",
      ],
    },
  },

  {
    id: "l4-3",
    level: 4,
    title: "Buzzers and Making Sound",
    body: [
      { type: "p", text:
        "A buzzer converts an electrical signal into sound. The simplest kind just clicks when the " +
        "voltage changes - toggle it fast enough with digitalWrite() and those clicks blur into a tone. " +
        "Arduino gives you a built-in function that does exactly this timing for you: tone()." },
      { type: "code", text:
        "tone(8, 440);      // play a 440Hz tone (concert-pitch A) on pin 8, until told to stop\ndelay(500);\nnoTone(8);          // stop the tone" },
      { type: "p", text:
        "tone(pin, frequency) starts a square wave at that frequency on the given pin, playing " +
        "continuously in the background - your code keeps running while it plays. noTone(pin) stops it. " +
        "You can optionally pass a third argument, a duration in milliseconds, and it will stop itself: " +
        "tone(8, 440, 500) plays for exactly half a second without needing a matching noTone()." },
      { type: "note", text:
        "Higher frequency numbers make a higher-pitched sound; lower numbers make a lower-pitched sound. " +
        "Human hearing roughly spans 20Hz to 20,000Hz, though most simple buzzers sound best somewhere in " +
        "the 200Hz-4000Hz range." },
    ],
    challenge: {
      id: "c12",
      title: "Build a Simple Alarm Beep",
      difficulty: "medium",
      prompt:
        "Wire a buzzer to pin 8. Make it play an alternating two-tone alarm sound: 800Hz for 200ms, then " +
        "1200Hz for 200ms, repeating forever - like a simple siren.",
      hints: [
        "Concept hint: an \"alternating\" sound is just two tone() calls in a row, each followed by " +
          "enough of a pause to actually hear that pitch before switching to the next one.",
        "Function hint: tone(pin, frequency, duration) can handle the timing itself if you also delay() " +
          "for roughly that same duration afterward, so the next call doesn't cut the first tone off early.",
        "Example hint: tone(8, 800, 200); delay(200); tone(8, 1200, 200); delay(200); - repeated inside " +
          "loop(), this alternates between the two pitches automatically.",
      ],
      solution:
        "int buzzerPin = 8;\n\nvoid setup() {\n}\n\nvoid loop() {\n  tone(buzzerPin, 800, 200);\n  delay(200);\n  tone(buzzerPin, 1200, 200);\n  delay(200);\n}",
      explain: [
        "tone(buzzerPin, 800, 200) plays 800Hz for 200ms and then automatically stops - no noTone() needed " +
          "since a duration was given.",
        "delay(200) matches that duration, so the next line doesn't run (and interrupt the tone) until " +
          "it's actually finished playing.",
        "The second tone() call does the same thing at 1200Hz, and because this whole block is inside " +
          "loop(), the two-tone pattern repeats indefinitely.",
      ],
    },
  },

  {
    id: "l4-4",
    level: 4,
    title: "RGB LEDs and Mixing Color",
    body: [
      { type: "p", text:
        "An RGB LED is really three LEDs (Red, Green, Blue) in one package, sharing a common pin " +
        "(usually the cathode/ground side). Each color channel is controlled independently, and since " +
        "human eyes blend closely-overlapping light, driving all three with PWM lets you mix nearly any color." },
      { type: "code", text:
        "int redPin = 9, greenPin = 10, bluePin = 11;\n\nvoid setup() {\n  pinMode(redPin, OUTPUT);\n  pinMode(greenPin, OUTPUT);\n  pinMode(bluePin, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(redPin, 255);   // full red\n  analogWrite(greenPin, 0);\n  analogWrite(bluePin, 128);  // half blue -> a pink/magenta mix\n}" },
      { type: "p", text:
        "Each channel takes the same 0-255 range as any other analogWrite() call. Full red + full blue + " +
        "no green makes magenta; full red + full green + no blue makes yellow; all three at full makes " +
        "white (approximately, depending on the specific LED)." },
      { type: "note", text:
        "This is the exact same idea as mixing paint or mixing light on a screen - just with three " +
        "independently-controllable brightness channels instead of RGB pixel values." },
    ],
    challenge: {
      id: "c14",
      title: "💀 RGB Mood Light",
      difficulty: "boss",
      prompt:
        "Wire an RGB LED to pins 9 (red), 10 (green), and 11 (blue). Build a \"mood light\" that smoothly " +
        "cycles through colors forever - not snapping between fixed colors, but continuously drifting, " +
        "the way a real mood lamp does.",
      hints: [
        "Concept hint: a smooth color cycle is really three independent fades (like the earlier LED-fade " +
          "challenge) running at the same time, one per channel, ideally out of sync with each other so " +
          "they blend into new colors as they drift.",
        "Function hint: give each channel its own brightness variable AND its own step variable (like the " +
          "fade challenge), and flip each one's direction independently when it hits 0 or 255.",
        "Example hint: a simple trick that looks great with much less code: keep ONE variable (0-255) and " +
          "derive red/green/blue from it with a bit of arithmetic, e.g. green = 255 - red, blue = (red + " +
          "128) % 256 - experiment and see what patterns you get.",
      ],
      solution:
        "int redPin = 9, greenPin = 10, bluePin = 11;\nint redVal = 255, redStep = -3;\nint greenVal = 0, greenStep = 4;\nint blueVal = 128, blueStep = 5;\n\nvoid setup() {\n  pinMode(redPin, OUTPUT);\n  pinMode(greenPin, OUTPUT);\n  pinMode(bluePin, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(redPin, redVal);\n  analogWrite(greenPin, greenVal);\n  analogWrite(bluePin, blueVal);\n\n  if (redVal >= 255) { redStep = -3; } else if (redVal <= 0) { redStep = 3; }\n  if (greenVal >= 255) { greenStep = -4; } else if (greenVal <= 0) { greenStep = 4; }\n  if (blueVal >= 255) { blueStep = -5; } else if (blueVal <= 0) { blueStep = 5; }\n\n  redVal = redVal + redStep;\n  greenVal = greenVal + greenStep;\n  blueVal = blueVal + blueStep;\n\n  delay(20);\n}",
      explain: [
        "Each color channel gets its own value AND its own step size (3, 4, 5) - using DIFFERENT step " +
          "sizes per channel is what makes them drift out of sync with each other instead of all peaking " +
          "at the same moment, which is what produces new blended colors over time.",
        "Each channel's if / else if independently flips that channel's direction when it hits a boundary " +
          "- exactly the same pattern as the single-LED fade challenge, just done three times in parallel.",
        "Because all three analogWrite() calls happen every loop() with no delay between them, the three " +
          "channels update together - only the SPEED and TIMING of each one's fade differs.",
      ],
    },
  },

  {
    id: "l4-5",
    level: 4,
    title: "Servo Motors",
    body: [
      { type: "p", text:
        "A servo motor is different from the motors you might picture spinning freely - it rotates to a " +
        "specific ANGLE (typically 0-180 degrees) and holds that position, controlled by sending it the " +
        "angle you want." },
      { type: "p", text:
        "Controlling a servo needs the Servo library, which is built into the Arduino IDE. You declare a " +
        "Servo object, attach() it to a pin in setup(), then call write() with an angle whenever you want " +
        "it to move." },
      { type: "code", text:
        "#include <Servo.h>\n\nServo myServo;\n\nvoid setup() {\n  myServo.attach(9);\n}\n\nvoid loop() {\n  myServo.write(0);    // rotate to 0 degrees\n  delay(1000);\n  myServo.write(180);  // rotate to 180 degrees\n  delay(1000);\n}" },
      { type: "note", text:
        "This is your first look at an Arduino LIBRARY and an OBJECT (myServo is an object of type Servo, " +
        "and attach()/write() are its methods - functions that belong to that specific object). You'll " +
        "meet this same object.method() pattern again for other library-based components." },
    ],
    challenge: {
      id: "c13",
      title: "Sweep a Servo Back and Forth",
      difficulty: "medium",
      prompt:
        "Wire a servo's signal lead to pin 9. Write a sketch that continuously sweeps it from 0 degrees " +
        "to 180 degrees, then back to 0, in smooth small steps rather than one big jump.",
      hints: [
        "Concept hint: \"smooth\" means small steps with a short pause between each one - the same " +
          "back-and-forth counting pattern you used to fade an LED, just applied to an angle instead of a " +
          "brightness value.",
        "Function hint: keep a variable for the current angle (0-180) and a variable for the step " +
          "direction, exactly like the LED fade challenge - flip the direction at each end, call " +
          "myServo.write(angle) every step.",
        "Example hint: for (int angle = 0; angle <= 180; angle = angle + 1) { myServo.write(angle); " +
          "delay(15); } sweeps one direction - you'd need a second, mirrored for loop (180 down to 0) " +
          "right after it to sweep back.",
      ],
      solution:
        "Servo myServo;\n\nvoid setup() {\n  myServo.attach(9);\n}\n\nvoid loop() {\n  for (int angle = 0; angle <= 180; angle = angle + 1) {\n    myServo.write(angle);\n    delay(15);\n  }\n  for (int angle = 180; angle >= 0; angle = angle - 1) {\n    myServo.write(angle);\n    delay(15);\n  }\n}",
      explain: [
        "myServo.attach(9) runs once in setup(), telling the Servo library which pin to send position " +
          "signals on.",
        "The first for loop counts angle up from 0 to 180 one degree at a time, calling write() and " +
          "pausing 15ms at each step - that pause is what makes the motion visibly smooth instead of instant.",
        "The second for loop mirrors the first, counting back down from 180 to 0 - together, one full " +
          "pass through loop() is a complete there-and-back sweep, which then repeats forever.",
      ],
    },
  },

  {
    id: "l4-6",
    level: 4,
    title: "Basic DC Motor Concepts",
    body: [
      { type: "p", text:
        "Unlike a servo, a plain DC motor just spins continuously when powered, at a speed roughly " +
        "proportional to the voltage across it - there's no built-in \"go to this angle\" behavior." },
      { type: "p", text:
        "Recall from Level 1: a digital pin can only safely supply about 20-40mA. A small DC motor can " +
        "easily demand hundreds of mA to amps, especially when starting up - wiring one directly to an " +
        "Arduino pin will not spin it properly, and can permanently damage the pin." },
      { type: "note", text:
        "The real solution is a motor driver (an H-bridge chip or module, e.g. the L298N) - the Arduino " +
        "sends it a low-power PWM control signal, and the driver, powered separately by a stronger supply, " +
        "handles the actual current the motor needs. We don't have a motor driver component in this " +
        "simulator yet, so for now, focus on the concept: Arduino pins control things, they rarely power " +
        "them directly." },
    ],
  },
];
