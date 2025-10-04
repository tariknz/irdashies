/* eslint-disable @typescript-eslint/no-require-imports */
const NativeSDK = require("../build/Debug/irsdk_node.node").iRacingSdkNode;
const path = require("path");
const fs = require("fs");

const TARGET_FILE = "_GENERATED_telemetry.ts";
const OUT_PATH = path.resolve(process.cwd(), "../types/", TARGET_FILE);

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
