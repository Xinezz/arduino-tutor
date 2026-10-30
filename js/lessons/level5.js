// Level 5: Program Flow - decisions, logic, loops, functions and millis().
// It's numbered 5 for historical reasons (saved progress and trophies use the
// number), but it's taught SECOND, straight after Arduino Basics: everything
// in Digital I/O onwards leans on if/else and loops. See LEVEL_ORDER in
// levels.js.
//
// Each lesson follows the course's learning loop:
//   objectives -> explanation -> a "Try it" sketch (runs in the editor) ->
//   a predict-then-explain question -> common mistakes -> a checked challenge
// The predict blocks' `output` is checked against the simulator by the tests,
// so a prediction's "right answer" can never drift from what really happens.
//
// Almost everything here only needs the Serial Monitor - no wiring - so it
// works for someone without any hardware at all.

export const level5Lessons = [
  {
    id: "l5-1",
    level: 5,
    title: "Making Decisions: if and else",
    body: [
      { type: "objectives", items: [
        "Explain what a condition is: a question whose answer is true or false",
        "Use if to run code only when a condition is true",
        "Use else and else if to choose between options",
      ] },
      { type: "p", text:
        "So far, every line of a sketch runs every time. Real programs need to make decisions: turn the " +
        "fan on only if it's hot, sound the alarm only if a door opens. That's what if is for." },
      { type: "code", text: "int temperature = 32;\n\nif (temperature > 30) {\n  Serial.println(\"Too hot!\");\n}" },
      { type: "p", text:
        "The part in brackets is the condition - a question with a yes-or-no answer. If it's true, the code " +
        "inside the { } runs. If it's false, that code is skipped completely, as if it wasn't there." },
      { type: "p", text:
        "else adds an \"otherwise\" branch. else if checks another condition when the first one was false. " +
        "The Arduino tries them from the top, runs the FIRST one that's true, and skips the rest." },
      { type: "code", text:
        "int temperature = 25;\n\nvoid setup() {\n  Serial.begin(9600);\n  if (temperature > 30) {\n    Serial.println(\"Too hot\");\n  } else if (temperature < 15) {\n    Serial.println(\"Too cold\");\n  } else {\n    Serial.println(\"Just right\");\n  }\n}\n\nvoid loop() {\n}" },
      { type: "predict",
        question: "With temperature set to 25, what will this sketch print?",
        options: ["Too hot", "Too cold", "Just right", "Nothing at all"],
        answer: 2,
        output: "Just right",
        explain:
          "25 isn't greater than 30, so the first condition is false. 25 isn't less than 15 either, so the " +
          "else if is false too. Only the else is left, so it prints Just right. Press Try it, change 25 to 35 " +
          "or 5, and run it again." },
      { type: "mistakes", items: [
        "Writing = instead of ==. if (x = 5) STORES 5 in x instead of comparing - and the condition is then always true. The simulator warns you when it sees this.",
        "A semicolon straight after the condition: if (x > 5); { ... }. The ; ends the if right there, so the block below runs every time.",
        "Leaving out the braces. Without { }, only the very next line belongs to the if.",
      ] },
    ],
    challenge: {
      id: "c19",
      title: "Odd or Even?",
      difficulty: "easy",
      prompt:
        "Make a counter that starts at 1 and goes up by 1 every second. Each second, print the number and " +
        "whether it's odd or even - for example: 1 is odd, then 2 is even, then 3 is odd.\n\n" +
        "Maths you'll need: the % operator gives the remainder of a division. An even number divided by 2 " +
        "leaves a remainder of 0.",
      hints: [
        "Concept hint: the counter has to remember its value between passes of loop() - so declare it at the " +
          "top of the sketch, outside every function.",
        "Function hint: count % 2 is 0 for even numbers and 1 for odd ones. Use it as the condition of an " +
          "if / else.",
        "Example hint: Serial.print(count); prints the number without ending the line, so the next " +
          "Serial.println(\" is even\"); finishes the same line.",
      ],
      solution:
        "int count = 1;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.print(count);\n  if (count % 2 == 0) {\n    Serial.println(\" is even\");\n  } else {\n    Serial.println(\" is odd\");\n  }\n  count = count + 1;\n  delay(1000);\n}",
      explain: [
        "count is declared at the top, so it keeps its value from one pass of loop() to the next.",
        "count % 2 == 0 is true exactly when count divides by 2 with nothing left over - an even number - so " +
          "the if prints \" is even\", and the else handles every other case.",
        "count = count + 1 then delay(1000) moves on to the next number once a second.",
      ],
    },
  },

  {
    id: "l5-2",
    level: 5,
    title: "Comparisons and Logic: ==, <, &&, ||",
    body: [
      { type: "objectives", items: [
        "Compare values with ==, !=, <, >, <= and >=",
        "Combine conditions with && (and), || (or) and ! (not)",
        "Read a combined condition step by step, the way the Arduino does",
      ] },
      { type: "p", text: "Every condition is built from comparisons. There are six:" },
      { type: "code", text:
        "a == b   // equal to (two = signs!)\na != b   // not equal to\na <  b   // less than\na <= b   // less than or equal to\na >  b   // greater than\na >= b   // greater than or equal to" },
      { type: "p", text:
        "To ask more than one question at once, combine comparisons: && means AND (both must be true), " +
        "|| means OR (at least one must be true), and ! means NOT (it flips true and false)." },
      { type: "code", text:
        "int hour = 7;\nbool isWeekend = false;\n\nvoid setup() {\n  Serial.begin(9600);\n  if (hour >= 7 && hour < 9 && !isWeekend) {\n    Serial.println(\"Time for school\");\n  }\n  if (hour < 6 || hour > 22) {\n    Serial.println(\"Time to sleep\");\n  }\n}\n\nvoid loop() {\n}" },
      { type: "predict",
        question: "With hour = 7 and isWeekend = false, what does it print?",
        options: ["Time for school", "Time to sleep", "Both lines", "Nothing"],
        answer: 0,
        output: "Time for school",
        explain:
          "hour >= 7 is true, hour < 9 is true, and !isWeekend is true (NOT false), so all three parts of the && " +
          "are true and it prints Time for school. For the second if, 7 < 6 is false AND 7 > 22 is false - with " +
          "|| at least one has to be true, so nothing more is printed." },
      { type: "mistakes", items: [
        "Writing 18 < temp < 24 to mean \"between\". C++ reads it as (18 < temp) < 24: the first part becomes true or false (1 or 0), which is always less than 24. Write temp > 18 && temp < 24.",
        "Mixing up && and ||. \"Between 18 and 24\" needs both sides true: &&. \"Too cold or too hot\" needs either one: ||.",
        "Using = (store) where you meant == (compare).",
      ] },
    ],
    challenge: {
      id: "c20",
      title: "Comfort Zone",
      difficulty: "medium",
      prompt:
        "A greenhouse is comfortable from 18°C to 24°C - including 18 and 24. Start with int temp = 10. " +
        "Every half second, print the temperature followed by \"too cold\", \"comfortable\" or \"too hot\", " +
        "then add 2 to temp. When temp goes above 40, set it back to 10 so it keeps cycling.",
      hints: [
        "Concept hint: three possible answers means one if, one else if and one else - the first true " +
          "condition wins.",
        "Function hint: \"from 18 to 24, including both\" is temp >= 18 && temp <= 24. Watch out for 18 and 24 " +
          "themselves - that's where off-by-one mistakes hide.",
        "Example hint: after adding 2, a separate if (temp > 40) { temp = 10; } starts the cycle again.",
      ],
      solution:
        "int temp = 10;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.print(temp);\n  if (temp < 18) {\n    Serial.println(\" too cold\");\n  } else if (temp >= 18 && temp <= 24) {\n    Serial.println(\" comfortable\");\n  } else {\n    Serial.println(\" too hot\");\n  }\n  temp = temp + 2;\n  if (temp > 40) {\n    temp = 10;\n  }\n  delay(500);\n}",
      explain: [
        "The first condition catches everything below 18. Because else if only runs when the first was false, " +
          "it already knows temp is at least 18.",
        "temp >= 18 && temp <= 24 uses >= and <= so that 18 and 24 themselves count as comfortable.",
        "The final else catches everything above 24, and the separate if after adding 2 wraps temp back to 10.",
      ],
    },
  },

  {
    id: "l5-3",
    level: 5,
    title: "Repeating with for Loops",
    body: [
      { type: "objectives", items: [
        "Repeat code an exact number of times with a for loop",
        "Name the three parts of a for loop: start, condition and step",
        "Use the loop's counter variable inside the loop",
      ] },
      { type: "p", text:
        "loop() repeats forever - but often you want something to happen an exact number of times: blink 3 " +
        "times, count to 10, sweep a servo from 0° to 180°. That's what a for loop does." },
      { type: "code", text: "for (int i = 0; i < 5; i++) {\n  Serial.println(i);\n}" },
      { type: "p", text:
        "Its three parts, separated by semicolons: the START (int i = 0 - a counter is created once), the " +
        "CONDITION (i < 5 - checked before every pass; the loop stops when it's false) and the STEP (i++ - adds " +
        "1 after every pass). This one prints 0, 1, 2, 3, 4: five passes, starting from 0." },
      { type: "code", text:
        "void setup() {\n  Serial.begin(9600);\n  for (int i = 1; i <= 3; i++) {\n    Serial.print(\"Pass number \");\n    Serial.println(i);\n  }\n  Serial.println(\"Done\");\n}\n\nvoid loop() {\n}" },
      { type: "predict",
        question: "How many lines will this sketch print in total?",
        options: ["3", "4", "5", "It never stops"],
        answer: 1,
        output: "Pass number 1\nPass number 2\nPass number 3\nDone",
        explain:
          "i starts at 1 and the loop keeps going while i <= 3, so it runs for 1, 2 and 3 - three lines. Then " +
          "the loop ends and Done is printed once: four lines in all. It's in setup(), so it only happens once." },
      { type: "mistakes", items: [
        "Off by one: i < 5 runs 5 times (0 to 4), but i <= 5 runs 6 times (0 to 5). Always check where you start and where you stop.",
        "A semicolon after the brackets: for (...); { ... } repeats NOTHING, then runs the block once.",
        "Using the counter after the loop. i only exists inside the for - outside it, it was never declared.",
      ] },
    ],
    challenge: {
      id: "c21",
      title: "Countdown to Liftoff",
      difficulty: "easy",
      prompt:
        "In setup(), use a for loop to print the numbers 10 down to 1, one per line, half a second apart. " +
        "Then print Liftoff! - just once. Leave loop() empty.",
      hints: [
        "Concept hint: a for loop can count down as well as up - it just needs a different start, condition " +
          "and step.",
        "Function hint: start at 10, keep going while the counter is at least 1 (>= 1), and take 1 away each " +
          "time (i--).",
        "Example hint: for (int i = 10; i >= 1; i--) { Serial.println(i); delay(500); } - then the Liftoff! " +
          "line goes after the loop's closing }.",
      ],
      solution:
        "void setup() {\n  Serial.begin(9600);\n  for (int i = 10; i >= 1; i--) {\n    Serial.println(i);\n    delay(500);\n  }\n  Serial.println(\"Liftoff!\");\n}\n\nvoid loop() {\n}",
      explain: [
        "int i = 10 starts the counter at 10, i >= 1 keeps the loop going down to 1, and i-- takes 1 away " +
          "after every pass.",
        "delay(500) inside the loop puts half a second between the numbers.",
        "Liftoff! is printed after the loop's closing brace, so it happens once, after 1 - and because all of " +
          "this is in setup(), the countdown never repeats.",
      ],
    },
  },

  {
    id: "l5-4",
    level: 5,
    title: "while Loops: Repeat Until Something Happens",
    body: [
      { type: "objectives", items: [
        "Repeat code for as long as a condition stays true",
        "Choose between a for loop and a while loop",
        "Spot a loop that can never end",
      ] },
      { type: "p", text:
        "A for loop is for \"do this N times\". A while loop is for \"keep going until something happens\" - " +
        "when you don't know in advance how many passes it will take." },
      { type: "code", text: "int total = 0;\nwhile (total < 20) {\n  total = total + 7;\n}" },
      { type: "p", text:
        "The condition is checked BEFORE every pass. If it's true, the body runs, then it's checked again. " +
        "The moment it's false, the loop ends and the sketch carries on after the }." },
      { type: "code", text:
        "void setup() {\n  Serial.begin(9600);\n  int total = 0;\n  int steps = 0;\n  while (total < 20) {\n    total = total + 7;\n    steps = steps + 1;\n  }\n  Serial.print(\"Steps: \");\n  Serial.println(steps);\n  Serial.print(\"Total: \");\n  Serial.println(total);\n}\n\nvoid loop() {\n}" },
      { type: "predict",
        question: "What will this sketch print?",
        options: ["Steps: 2 and Total: 14", "Steps: 3 and Total: 21", "Steps: 3 and Total: 20", "Nothing - it never stops"],
        answer: 1,
        output: "Steps: 3\nTotal: 21",
        explain:
          "total goes 0 → 7 → 14 → 21. After the third pass, 21 < 20 is false, so the loop stops - with total " +
          "already past 20. A while loop doesn't stop exactly AT a value; it stops the first time the " +
          "condition is false." },
      { type: "mistakes", items: [
        "A condition that can never become false: while (x < 10) with nothing inside changing x runs forever, and nothing after it ever happens. (In the simulator, Stop still works.)",
        "Using while when you know the count. for (int i = 0; i < 10; i++) says \"exactly 10 times\" much more clearly.",
        "Remember: loop() itself is a loop the Arduino runs for you, forever. You don't need a while loop to make the whole sketch repeat.",
      ] },
    ],
    challenge: {
      id: "c22",
      title: "Doubling Up",
      difficulty: "medium",
      prompt:
        "In setup(), start with a number at 1 and keep doubling it as long as it's less than 1000, printing " +
        "each value on its own line. Then print Done. You should see 1, 2, 4, 8 ... 512, then Done. Use a " +
        "while loop.",
      hints: [
        "Concept hint: you don't know how many doublings it takes to pass 1000 - that's exactly what a while " +
          "loop is for.",
        "Function hint: while (value < 1000) { ... } - and inside, print value, then double it.",
        "Example hint: print BEFORE doubling, so the first line is 1 and the loop stops before printing 1024.",
      ],
      solution:
        "void setup() {\n  Serial.begin(9600);\n  int value = 1;\n  while (value < 1000) {\n    Serial.println(value);\n    value = value * 2;\n  }\n  Serial.println(\"Done\");\n}\n\nvoid loop() {\n}",
      explain: [
        "value starts at 1, and while (value < 1000) keeps the loop going as long as it's below 1000.",
        "Printing before doubling means the values shown are 1, 2, 4 ... 512. Doubling 512 gives 1024, the " +
          "condition becomes false, and the loop ends without printing it.",
        "Done comes after the loop, so it's printed exactly once.",
      ],
    },
  },

  {
    id: "l5-5",
    level: 5,
    title: "Writing Your Own Functions",
    body: [
      { type: "objectives", items: [
        "Group steps into a function with a name you choose",
        "Pass information into a function with parameters",
        "Send a result back with return",
      ] },
      { type: "p", text:
        "You've been calling functions all along: pinMode(), digitalWrite(), delay(). You can write your own " +
        "too - it turns a block of steps into one command with a meaningful name, and you can use it as often " +
        "as you like." },
      { type: "code", text:
        "void blinkOnce(int pin) {\n  digitalWrite(pin, HIGH);\n  delay(200);\n  digitalWrite(pin, LOW);\n  delay(200);\n}" },
      { type: "p", text:
        "void means this function doesn't hand anything back. int pin is a PARAMETER: a variable that gets its " +
        "value from whoever calls the function, so blinkOnce(13) runs it with pin set to 13, and blinkOnce(9) " +
        "with 9." },
      { type: "p", text:
        "A function can also work something out and hand it back with return. Its type (int, float...) says " +
        "what kind of value comes back, and return ends the function straight away." },
      { type: "code", text:
        "int square(int x) {\n  return x * x;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  for (int i = 1; i <= 4; i++) {\n    Serial.println(square(i));\n  }\n}\n\nvoid loop() {\n}" },
      { type: "predict",
        question: "What does this sketch print?",
        options: ["1, 2, 3, 4", "1, 4, 9, 16", "2, 4, 6, 8", "Nothing - square() is never called"],
        answer: 1,
        output: "1\n4\n9\n16",
        explain:
          "Each pass of the for loop calls square(i). Inside, x takes i's value, and return x * x hands back " +
          "1, 4, 9 and 16, which Serial.println() prints." },
      { type: "mistakes", items: [
        "Calling a function with the wrong number of values: blinkOnce() needs exactly one. The simulator tells you what it expects.",
        "Forgetting return in a function that promises a value (int, float...) - on a real board the result is garbage. The simulator warns you.",
        "Expecting a variable declared inside one function to exist in another. Pass the value in as a parameter instead.",
      ] },
    ],
    challenge: {
      id: "c23",
      title: "Blink Code",
      difficulty: "medium",
      prompt:
        "Wire an LED to pin 13. Write a function void blinkTimes(int times) that blinks the LED that many " +
        "times (200 ms on, 200 ms off). In loop(), call blinkTimes(3) and then wait one second - so you see " +
        "three quick blinks, a pause, and again.",
      hints: [
        "Concept hint: the function's job is \"blink N times\" - which is a job for a loop, with N coming from " +
          "the parameter.",
        "Function hint: inside blinkTimes, use for (int i = 0; i < times; i++) { ... } around one on-off blink.",
        "Example hint: loop() only needs two lines: blinkTimes(3); and delay(1000);. Don't forget pinMode() " +
          "in setup().",
      ],
      solution:
        "int ledPin = 13;\n\nvoid blinkTimes(int times) {\n  for (int i = 0; i < times; i++) {\n    digitalWrite(ledPin, HIGH);\n    delay(200);\n    digitalWrite(ledPin, LOW);\n    delay(200);\n  }\n}\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  blinkTimes(3);\n  delay(1000);\n}",
      explain: [
        "blinkTimes takes one parameter, times, and its for loop runs one on-off blink that many times.",
        "Because the number comes in as a parameter, the same function could blink 5 times with " +
          "blinkTimes(5) - no copied code.",
        "loop() just calls it with 3 and pauses for a second, so the pattern is three blinks, a pause, repeat.",
      ],
    },
  },

  {
    id: "l5-6",
    level: 5,
    title: "Doing Two Things at Once with millis()",
    body: [
      { type: "objectives", items: [
        "Explain why delay() stops everything else from happening",
        "Use millis() to check how much time has passed",
        "Run two timed jobs side by side without delay()",
      ] },
      { type: "p", text:
        "delay(1000) freezes the whole sketch for a second. While it waits, the Arduino can't read a button, " +
        "check a sensor or do anything else. One timed job is fine - but two at once, each with its own " +
        "timing, can't both be delays." },
      { type: "p", text:
        "millis() returns how many milliseconds have passed since the board started. Instead of waiting, " +
        "you CHECK: has enough time passed since I last did this? If yes, do it and remember when. If not, " +
        "carry on - loop() will come round again in a moment." },
      { type: "code", text:
        "unsigned long lastBlink = 0;\nint ledState = LOW;\n\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  if (millis() - lastBlink >= 500) {\n    lastBlink = millis();\n    ledState = !ledState;\n    digitalWrite(13, ledState);\n  }\n  // nothing here ever waits - anything else could run on every pass\n}" },
      { type: "predict",
        question: "This sketch waits 1.5 seconds, then prints millis() / 1000. What appears?",
        code: "void setup() {\n  Serial.begin(9600);\n  delay(1500);\n  Serial.println(millis() / 1000);\n}\n\nvoid loop() {\n}",
        options: ["0", "1", "1.5", "1500"],
        answer: 1,
        output: "1",
        explain:
          "After delay(1500), millis() is 1500. 1500 / 1000 is a whole-number division (both are whole " +
          "numbers), so the remainder is dropped and it prints 1." },
      { type: "mistakes", items: [
        "Storing millis() in an int. An int on an Uno only reaches 32767 - about 33 seconds - then wraps to a negative number. Use unsigned long.",
        "Writing millis() - lastBlink >= 500 the other way round. lastBlink - millis() is negative (it wraps to a huge number), so the check is always true.",
        "Forgetting to update lastBlink. Then the condition stays true and the job runs on every single pass.",
      ] },
    ],
    challenge: {
      id: "c24",
      title: "Blink and Report",
      difficulty: "boss",
      prompt:
        "Wire an LED to pin 13. WITHOUT using delay() anywhere, blink the LED (on 500 ms, off 500 ms) and, at " +
        "the same time, print Still running to the Serial Monitor every 2 seconds.",
      hints: [
        "Concept hint: two jobs with different timings means two \"when did I last do this?\" variables - one " +
          "for the blink, one for the message.",
        "Function hint: unsigned long lastBlink = 0; and unsigned long lastReport = 0; at the top, then two " +
          "separate if (millis() - ... >= ...) checks in loop().",
        "Example hint: if (millis() - lastReport >= 2000) { lastReport = millis(); Serial.println(\"Still " +
          "running\"); } - and the blink check is the same shape with 500.",
      ],
      solution:
        "int ledPin = 13;\nunsigned long lastBlink = 0;\nunsigned long lastReport = 0;\nint ledState = LOW;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  unsigned long now = millis();\n\n  if (now - lastBlink >= 500) {\n    lastBlink = now;\n    ledState = !ledState;\n    digitalWrite(ledPin, ledState);\n  }\n\n  if (now - lastReport >= 2000) {\n    lastReport = now;\n    Serial.println(\"Still running\");\n  }\n}",
      explain: [
        "Each job has its own unsigned long that remembers when it last ran - so the two timings never get in " +
          "each other's way.",
        "Every pass of loop() just checks both: has 500 ms passed since the last blink? Has 2000 ms passed " +
          "since the last message? Only the jobs that are due do anything.",
        "Because nothing ever waits, loop() spins thousands of times a second - which is exactly what lets " +
          "a sketch like this also react to buttons or sensors instantly.",
      ],
    },
  },
];
