// Arrays: declaring, reading, writing, looping, sizeof, passing to a
// function, and a 2D grid. Wire LEDs to pins 2, 3 and 4 to watch them chase.
// The Serial Monitor should show:
//   3 LEDs
//   sum = 60
//   doubled: 20 40 60
//   grid[1][2] = 6

int ledPins[] = {2, 3, 4};
const int NUM_LEDS = sizeof(ledPins) / sizeof(ledPins[0]);
int values[3] = {10, 20, 30};
int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};

int sum(int arr[], int count) {
  int total = 0;
  for (int i = 0; i < count; i++) {
    total += arr[i];
  }
  return total;
}

void doubleAll(int arr[], int count) {
  for (int i = 0; i < count; i++) {
    arr[i] = arr[i] * 2;   // arrays are passed by reference: this changes the caller's array
  }
}

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < NUM_LEDS; i++) {
    pinMode(ledPins[i], OUTPUT);
  }
  Serial.print(NUM_LEDS);
  Serial.println(" LEDs");
  Serial.print("sum = ");
  Serial.println(sum(values, 3));
  doubleAll(values, 3);
  Serial.print("doubled:");
  for (int i = 0; i < 3; i++) {
    Serial.print(" ");
    Serial.print(values[i]);
  }
  Serial.println();
  Serial.print("grid[1][2] = ");
  Serial.println(grid[1][2]);
}

void loop() {
  for (int i = 0; i < NUM_LEDS; i++) {
    digitalWrite(ledPins[i], HIGH);
    delay(200);
    digitalWrite(ledPins[i], LOW);
  }
}
