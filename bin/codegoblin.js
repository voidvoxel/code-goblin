#!/usr/bin/env node

const { CodeGoblin } = require("../src");

const args = require("../src/args");

const DEFAULT_PROGRAMMING_LANGUAGE = "javascript";

const EXAMPLE_PROMPTS = [
  "a function that takes 2 numbers and adds them together",
  "a function that takes 2 positions in 3D space and calculates the distance between them"
];

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
  const sourceCode = await codeGoblin.code(
    description,
    {
      callback: e => {
        process.stdout.write(e.token); return;
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
          lineLowerCase.includes("already correct")
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
        process.stdout.write(e.token); return;
      },
      programmingLanguage
    }
  );

  return fixedSourceCode;
}

async function main() {
  const codeGoblin = new CodeGoblin();

  const programmingLanguage = args.values.language;

  const prompt = args.positionals.join(" ");

  // if (args.values.code) await analyze(codeGoblin, prompt);
  if (args.values.code) await code(codeGoblin, prompt, programmingLanguage);
  // if (args.values.code) await comment(codeGoblin, prompt);
  else if (args.values.debug) await debug(codeGoblin, prompt, programmingLanguage);
  else if (args.values.fix) await fix(codeGoblin, prompt, programmingLanguage);
  else {
    console.error("Please run `codegoblin -h` for help and usage.");

    process.exit(1);
  }
}

main.call();
