/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const fs = require("fs");

// Prefer Debug build but fall back to Release if Debug is not built.
const debugBinary = path.resolve(__dirname, "../build/Debug/irsdk_node.node");
const releaseBinary = path.resolve(__dirname, "../build/Release/irsdk_node.node");
let nativeBinary = null;
if (fs.existsSync(debugBinary)) nativeBinary = debugBinary;
else if (fs.existsSync(releaseBinary)) nativeBinary = releaseBinary;
else {
  console.error("Native module not found. Build the native addon (run the build script) and try again.");
  process.exit(1);
}
const NativeSDK = require(nativeBinary).iRacingSdkNode;

const TARGET_FILE = "_GENERATED_telemetry.ts";
const OUT_PATH = path.resolve(__dirname, "../../types/", TARGET_FILE);

// Ensure the output directory exists (robust when script is run from different CWDs)
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

console.log("Generating iRacing telemetry variable types.");
console.log("Make sure the sim is running!");

const sdk = new NativeSDK();
sdk.startSDK();

// Telemetry command, Start Recording
sdk.broadcast(10, 1);
// Wait a max of 5s
if (!sdk.waitForData(5000)) {
  process.stderr.write("No data. Make sure the sim is running and try again.");
  process.exit(1);
}

const varTypes = [
  "string",
  "boolean",
  "number",
  "number",
  "number",
  "number",
];

// Get all the types
const types = sdk.__getTelemetryTypes();
const out = `
// ! THIS FILE IS AUTO-GENERATED, EDITS WILL BE OVERRIDDEN !
// ! Make changes to the generate-var-types in @irsk-node/native !

/**
 * A variable included in the telemetry.
 */
export interface TelemetryVariable<VarType = number[]> {
  /** The name of the variable. */
  name: string;
  /** The description. */
  description: string;
  /** The unit of the value (ex. "kg/m^2") */
  unit: string;
  /** Should it be treated as a time? */
  countAsTime: boolean;
  /** The number of values provided. */
  length: number;
  /** The native variable type */
  varType: number;
  /** The current value of this variable. */
  value: VarType;
}

export interface TelemetryVarList {

  // Manually added entries
  dcPeakBrakeBias: TelemetryVariable<number[]>;

${Object.keys(types).map((varName) => 
  `  ${varName}: TelemetryVariable<${varTypes[types[varName]]}[]>`
).join(";\n")};
}
`;

fs.writeFile(OUT_PATH, out, "utf-8", (err) => {
  if (err) {
    console.error("There was an error creating the file:", err);
    return;
  }
  console.log("Successfully generated types!");
  process.exit(0);
});
