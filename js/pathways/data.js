// Engineering pathways: where a learner goes after the core course. Each
// pathway has three levels - Foundation (ideas, terms, demonstrations),
// Application (checked projects, modifying and troubleshooting) and
// Engineering design (an open-ended problem) - and the core lessons it
// needs first.
//
// Only Pathway A (Electronics Engineering) is built so far. The others are
// listed with what they will cover and what they'd need - honestly marked
// "not built yet", with nothing to open, so nothing is advertised that
// doesn't work.

import { ELECTRONICS_LESSONS } from "./electronics.js";
import { ELECTRONICS_PROJECTS } from "./electronicsProjects.js";

export const LEVEL_NAMES = { 1: "Foundation", 2: "Application", 3: "Engineering design" };
export const LEVEL_ABOUT = {
  1: "Understand the ideas and the terms, explore interactive demonstrations, check your understanding.",
  2: "Apply them: build and program circuits, modify designs, troubleshoot - every project checked by running your own work.",
  3: "Design: start from a problem and requirements, choose components, build, test against each requirement, explain your decisions.",
};
// How an activity runs - shown on every lesson and project.
export const RUNS = {
  simulated: { label: "Simulated", about: "Runs in the circuit simulator, and is checked by running your own code and reading your own circuit." },
  calculated: { label: "Calculated model", about: "An interactive demonstration computed from the standard formulas - not a circuit simulation. Each one says what it leaves out." },
  hardware: { label: "Real hardware", about: "Needs real parts the simulator doesn't have. Not checked, and not counted towards completion." },
};

export const PATHWAYS = [
  {
    id: "electronics", letter: "A", title: "Electronics Engineering", icon: "bolt", status: "available",
    summary: "How circuits really work: components, Ohm's and Kirchhoff's laws, dividers, pull resistors, capacitors, diodes and transistors - then designing a circuit of your own.",
    teaches: ["Electronic components and their ratings", "Ohm's law, power, and Kirchhoff's laws", "Series and parallel resistors, voltage dividers", "Pull-up and pull-down resistors", "Capacitors, diodes and transistor switches", "Circuit analysis and the design process"],
    builds: ["An LED control panel with a safe current budget", "A voltmeter from a voltage divider", "A light-sensitive night light", "An electronic alarm of your own design"],
    needs: ["m1-7", "l2-4"],
    levels: {
      1: { lessons: ["pe-1", "pe-2", "pe-3", "pe-4"], projects: [] },
      2: { lessons: ["pe-5", "pe-6", "pe-7", "pe-8"], projects: ["pe-led-control", "pe-divider-meter", "pe-light-circuit"] },
      3: { lessons: ["pe-9"], projects: ["pe-alarm"], designProject: "pe-alarm" },
    },
    hardware: "Everything except the transistor activity runs in the browser. Capacitors, diodes and transistors are taught with calculated models, because the simulator has no such parts.",
  },
  {
    id: "robotics", letter: "B", title: "Robotics and Automation", icon: "target", status: "planned",
    summary: "Sensors and actuators, DC, servo and stepper motors, motor drivers, PWM speed control, feedback and basic robot control logic.",
    teaches: ["Sensors and actuators", "DC, servo and stepper motors; motor drivers", "PWM motor control", "Feedback and automation"],
    builds: ["A servo-controlled mechanism", "An automated barrier gate", "An obstacle detector", "A motor speed controller"],
    needs: ["l4-5", "l4-6", "l6-5"],
    hardware: "The simulator runs servos and the sensors today; DC-motor speed, stepper and motor-driver models still need building - and would be simplified (no inertia or load), and labelled as such.",
  },
  {
    id: "sensors", letter: "C", title: "Sensors and Instrumentation", icon: "chart", status: "planned",
    summary: "Analog and digital sensors, calibration, measurement accuracy, noise and filtering, and collecting and interpreting data.",
    teaches: ["Temperature, ultrasonic, light and IR sensors", "Calibration and accuracy", "Noise and simple filtering", "Data collection and interpretation"],
    builds: ["A temperature monitor", "A distance-measuring device", "Automatic lighting", "A multi-sensor monitoring station"],
    needs: ["l6-4", "l6-1", "l3-6"],
    hardware: "Most of it can run in the simulator - its temperature, distance, light and IR sensors all exist. Real noise would be an added, labelled model.",
  },
  {
    id: "iot", letter: "D", title: "IoT and Smart Systems", icon: "monitor", status: "planned",
    summary: "Connected devices: microcontrollers with Wi-Fi (like the ESP32), sending and receiving data, MQTT, remote monitoring and IoT security.",
    teaches: ["What the Internet of Things is", "ESP32 basics - and how it differs from an Uno", "Sending data; MQTT concepts", "Security fundamentals"],
    builds: ["A smart-lighting simulation", "Remote sensor monitoring", "A temperature dashboard"],
    needs: ["l6-4", "l5-5"],
    hardware: "Real networking needs real hardware - an ESP32 (or similar) board, a Wi-Fi network and, for MQTT, a broker. The browser simulator is an Uno and can't connect to anything. An ESP32 is NOT an Uno: 3.3 V logic, different pins, a 12-bit (0-4095) ADC.",
  },
  {
    id: "programming", letter: "E", title: "Engineering Programming", icon: "puzzle", status: "planned",
    summary: "Code organisation for real systems: modular functions, state machines, event-driven code, arrays, data processing and debugging techniques.",
    teaches: ["Modular programming and functions", "State machines and events", "Arrays and sensor data processing", "Debugging and algorithm design"],
    builds: ["An automated traffic controller", "A multi-condition alarm", "A sensor-based decision system"],
    needs: ["l5-5", "l5-6"],
    hardware: "Runs entirely in the simulator.",
  },
];
export const pathwayById = (id) => PATHWAYS.find((p) => p.id === id) ?? null;

export const PATHWAY_LESSONS = ELECTRONICS_LESSONS.map((l) => ({ ...l, pathway: "electronics" }));
export const PATHWAY_PROJECTS = ELECTRONICS_PROJECTS;
const lessonMap = new Map(PATHWAY_LESSONS.map((l) => [l.id, l]));
export const pathwayLessonById = (id) => lessonMap.get(id) ?? null;
export const pathwayProjectById = (id) => PATHWAY_PROJECTS.find((p) => p.id === id) ?? null;

// "A2.3" - pathway letter, level, position in the pathway.
export function pathwayLessonLabel(lesson) {
  const p = pathwayById(lesson.pathway);
  const list = PATHWAY_LESSONS.filter((l) => l.pathway === lesson.pathway);
  return `${p.letter}${list.indexOf(lesson) + 1}`;
}

export const pathwayLessons = (pathwayId) => PATHWAY_LESSONS.filter((l) => l.pathway === pathwayId);
