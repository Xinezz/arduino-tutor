// Your own functions: parameters, return values, recursion, and early return.
// Paste into Free Practice and click Run - the Serial Monitor should show:
//   add(2, 3) = 5
//   average = 2.50
//   5! = 120
//   7 is odd
//   10 is even

int add(int a, int b) {
  return a + b;
}

float average(float x, float y) {
  return (x + y) / 2;
}

long factorial(int n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

bool isEven(int n) {
  return n % 2 == 0;
}

void report(int n) {
  Serial.print(n);
  if (isEven(n)) {
    Serial.println(" is even");
    return;
  }
  Serial.println(" is odd");
}

void setup() {
  Serial.begin(9600);
  Serial.print("add(2, 3) = ");
  Serial.println(add(2, 3));
  Serial.print("average = ");
  Serial.println(String(average(2, 3)));
  Serial.print("5! = ");
  Serial.println(factorial(5));
  report(7);
  report(10);
}

void loop() {
}
