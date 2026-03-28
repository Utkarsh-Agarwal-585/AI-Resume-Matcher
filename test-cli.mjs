#!/usr/bin/env node
/**
 * CLI test runner — no Chrome extension required.
 * Usage:
 *   node test-cli.mjs --key YOUR_GEMINI_KEY --resume resume.txt --jd jd.txt
 *   node test-cli.mjs --key YOUR_GEMINI_KEY --resume resume.txt --jd "paste JD text here"
 */

import { readFileSync, existsSync } from "fs";
import { runPipeline } from "./services/pipeline.js";
import { preprocessText } from "./utils/preprocess.js";

function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--key")    result.key    = args[++i];
        if (args[i] === "--resume") result.resume = args[++i];
        if (args[i] === "--jd")     result.jd     = args[++i];
    }
    return result;
}

function readInput(value) {
    if (!value) return "";
    // If it's a path to an existing file, read it; otherwise treat as raw text
    return existsSync(value) ? readFileSync(value, "utf8") : value;
}

const { key, resume, jd } = parseArgs();

if (!key || !resume || !jd) {
    console.error(`
Usage:
  node test-cli.mjs --key <GEMINI_API_KEY> --resume <resume.txt|text> --jd <jd.txt|text>

Examples:
  node test-cli.mjs --key AIza... --resume ./my_resume.txt --jd ./job_desc.txt
  node test-cli.mjs --key AIza... --resume ./my_resume.txt --jd "Senior SWE, 5 yrs experience..."
`);
    process.exit(1);
}

const resumeText = preprocessText(readInput(resume));
const jdText     = preprocessText(readInput(jd));

console.log("Running pipeline...\n");

try {
    const output = await runPipeline(key, resumeText, jdText);
    console.log(JSON.stringify(output, null, 2));
} catch (err) {
    console.error("Pipeline failed:", err.message);
    process.exit(1);
}
