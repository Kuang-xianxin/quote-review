import { evaluate } from "../core/evaluation.ts";
const result = await evaluate();
console.log(JSON.stringify(result, null, 2));
if (result.passed !== result.total) process.exitCode = 1;
