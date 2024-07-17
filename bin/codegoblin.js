#!/usr/bin/env node

const { readFile } = require("fs").promises;
const path = require("path");

const { CodeGoblin } = require("../src");

const args = require("../src/args");
const { open, writeFile } = require("fs/promises");

const DEFAULT_PROGRAMMING_LANGUAGE = "javascript";

const EXAMPLE_PROMPTS = [
  "a function that takes 2 numbers and adds them together",
  "a function that takes 2 positions in 3D space and calculates the distance between them"
];

let outputStream = process.stdout;

/**
 * Chat with Code Goblin.
 *
 * @param {CodeGoblin} codeGoblin
 * @param {string} prompt
 * @param {string} programmingLanguage
 * @returns
 */
async function chat(
  codeGoblin,
  prompt,
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const sourceCode = await codeGoblin.chat(
    prompt,
    {
      callback: e => {
        outputStream.write(e.token);
        return;
      },
      programmingLanguage
    }
  );

  return sourceCode;
}

/**
 * Generate source code from the given description.
 *
 * @param {CodeGoblin} codeGoblin
 * @param {string} description
 * @param {string} programmingLanguage
 * @returns
 */
async function code(
  codeGoblin,
  description,
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const sourceCode = await codeGoblin.generate(
    description,
    {
      callback: e => {
        outputStream.write(e.token);
        return;
      },
      programmingLanguage
    }
  );

  return sourceCode;
}

/**
 * Fix any bugs discovered in the the provided source code.
 *
 * @param {CodeGoblin} codeGoblin
 * @param {string} sourceCode
 * @param {string} programmingLanguage
 * @returns
 */
async function debug(
  codeGoblin,
  sourceCode,
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const answer = await codeGoblin.debug(
    sourceCode,
    {
      callback: e => {
        const { isNewLine } = e;

        if (!isNewLine) return;

        const {
          line,
          lineLowerCase
        } = e;

        if (
          lineLowerCase.includes("actually correct") ||
          lineLowerCase.includes("already correct") ||
          lineLowerCase.includes("cannot provide") ||
          lineLowerCase.includes("can't provide") ||
          lineLowerCase.includes("unable to provide")
        ) return;

        console.log(line);
      },
      programmingLanguage
    }
  );

  return answer;
}

/**
 * Fix any bugs discovered in the the provided source code.
 *
 * @param {CodeGoblin} codeGoblin
 * @param {string} sourceCode
 * @param {string} programmingLanguage
 * @returns
 */
async function fix(
  codeGoblin,
  sourceCode,
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const fixedSourceCode = await codeGoblin.fix(
    sourceCode,
    {
      callback: e => {
        outputStream.write(e.token); return;
      },
      programmingLanguage
    }
  );

  return fixedSourceCode;
}

async function main() {
  const codeGoblin = new CodeGoblin();

  const inputPath = args.values.input;
  const outputPath = args.values.output;
  const programmingLanguage = args.values.language;

  let prompt = args.positionals.join(" ");

  if (prompt.length <= 0 && inputPath && inputPath.length > 0) {
    prompt = await readFile(path.resolve(inputPath), 'utf-8');
  }

  if (prompt.length <= 0) process.exit(0);

  if (outputPath && outputPath.length > 0) outputStream = await open(outputPath, "w");

  let answer = null;

  // if (args.values.code) answer = await analyze(codeGoblin, prompt);
  if (args.values.code) answer = await code(codeGoblin, prompt, programmingLanguage);
  // if (args.values.code) answer = await comment(codeGoblin, prompt);
  else if (args.values.debug) answer = await debug(codeGoblin, prompt, programmingLanguage);
  else if (args.values.fix) answer = await fix(codeGoblin, prompt, programmingLanguage);
  else answer = await chat(codeGoblin, prompt, programmingLanguage);

  if (outputStream.close) {
    await outputStream.close();

    if (answer && answer.length > 0) await writeFile(outputPath, answer, "utf-8");
  }
  else process.stdout.clearLine();
}

main.call();
