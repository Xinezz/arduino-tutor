// Serial input: type into the box under the Serial Monitor and press Send.
// Try "on", "off", or a number like 250 to set the blink speed.
// Wire an LED to pin 13 (or watch the board's built-in LED).

int blinkMs = 500;
bool blinking = true;

void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("Type on, off, or a blink speed in ms:");
}

void loop() {
  if (Serial.available() > 0) {
    char first = Serial.peek();
    if (first >= '0' && first <= '9') {
      blinkMs = Serial.parseInt();
      Serial.read();  // drop the newline after the number
      Serial.print("Blink speed: ");
      Serial.println(blinkMs);
    } else {
      String command = Serial.readStringUntil('\n');
      command.trim();
      command.toLowerCase();
      if (command.equals("on")) {
        blinking = true;
        Serial.println("Blinking on");
      } else if (command == "off") {
        blinking = false;
        Serial.println("Blinking off");
      } else {
        Serial.print("Unknown command: ");
        Serial.println(command);
      }
    }
  }

  if (blinking) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(blinkMs);
    digitalWrite(LED_BUILTIN, LOW);
    delay(blinkMs);
  }
}
