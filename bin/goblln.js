#!/usr/bin/env node

const { readFile } = require("fs").promises;
const path = require("path");

const { Goblln } = require("../src");

const args = require("../src/args");
const { open, writeFile } = require("fs/promises");

const DEFAULT_PROGRAMMING_LANGUAGE = "javascript";

let outputStream = process.stdout;

/**
 * Chat with Goblln.
 *
 * @param {Goblln} goblln
 * @param {string} prompt
 * @param {string} programmingLanguage
 * @returns
 */
async function chat(
  goblln,
  prompt = "",
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const sourceCode = await goblln.chat(
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
 * Analyze the provided source code.
 *
 * @param {Goblln} goblln
 * @param {string} sourceCode
 * @param {string} programmingLanguage
 * @returns
 */
async function analyze(
  goblln,
  sourceCode = "",
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const analysis = await goblln.analyze(
    sourceCode,
    {
      callback: e => {
        outputStream.write(e.token);
        return;
      },
      programmingLanguage
    }
  );

  return analysis;
}

/**
 * Generate source code from the given description.
 *
 * @param {Goblln} goblln
 * @param {string} description
 * @param {string} programmingLanguage
 * @returns
 */
async function code(
  goblln,
  description = "",
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const sourceCode = await goblln.generate(
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
 * @param {Goblln} goblln
 * @param {string} sourceCode
 * @param {string} programmingLanguage
 * @returns
 */
async function debug(
  goblln,
  sourceCode = "",
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const answer = await goblln.debug(
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
 * @param {Goblln} goblln
 * @param {string} sourceCode
 * @param {string} programmingLanguage
 * @returns
 */
async function fix(
  goblln,
  sourceCode = "",
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const fixedSourceCode = await goblln.fix(
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

/**
 * Predict the next content.
 *
 * @param {Goblln} goblln
 * @param {string} content
 * @returns
 */
async function predict(
  goblln,
  content = ""
) {
  const output = await goblln.predict(
    content,
    {
      callback: e => {
        outputStream.write(e.token); return;
      }
    }
  );

  return output;
}

/**
 * Fix any bugs discovered in the the provided source code.
 *
 * @param {Goblln} goblln
 * @param {string} sourceCode
 * @param {string} programmingLanguage
 * @returns
 */
async function translate(
  goblln,
  sourceCode = "",
  programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE,
  inputProgrammingLanguage = DEFAULT_PROGRAMMING_LANGUAGE
) {
  const translatedSourceCode = await goblln.translate(
    sourceCode,
    {
      callback: e => {
        outputStream.write(e.token); return;
      },
      programmingLanguage,
      inputProgrammingLanguage
    }
  );

  return translatedSourceCode;
}

async function main() {
  const inputPath = args.values.input;
  const outputPath = args.values.output;

  let programmingLanguage = args.values.language;
  let inputProgrammingLanguage = null;

  let ollamaHost = args.values["ollama-host"];
  let ollamaProxy = args.values["ollama-proxy"];
  let ollamaModel = args.values.model;

  const ollamaOptions = {
    host: ollamaHost,
    model: ollamaModel,
    proxy: ollamaProxy
  };

  const gobllnOptions = {
    ollama: ollamaOptions
  };

  const goblln = new Goblln(gobllnOptions);

  if (inputPath) inputProgrammingLanguage = path.extname(inputPath).substring(1);

  if (
    outputPath && (
      !programmingLanguage || args.values.translate
    )
  ) programmingLanguage = path.extname(outputPath).substring(1);

  let prompt = args.positionals.join(" ");

  if (prompt.length <= 0 && inputPath && inputPath.length > 0) {
    prompt = await readFile(path.resolve(inputPath), 'utf-8');
  }

  if (prompt.length <= 0) process.exit(0);

  if (outputPath && outputPath.length > 0) outputStream = await open(outputPath, "w");

  let answer = null;

  if (args.values.analyze) answer = await analyze(goblln, prompt, programmingLanguage);
  if (args.values.code) answer = await code(goblln, prompt, programmingLanguage);
  // if (args.values.code) answer = await comment(goblln, prompt, programmingLanguage);
  else if (args.values.debug) answer = await debug(goblln, prompt, programmingLanguage);
  else if (args.values.fix) answer = await fix(goblln, prompt, programmingLanguage);
  else if (args.values.predict) answer = await  predict(goblln, prompt);
  else if (args.values.translate) answer = await translate(goblln, prompt, programmingLanguage, inputProgrammingLanguage);
  else answer = await chat(goblln, prompt, programmingLanguage);

  if (outputStream.close) {
    await outputStream.close();

    if (answer && answer.length > 0) await writeFile(outputPath, answer, "utf-8");
  }
  else process.stdout.clearLine();
}

main.call();
