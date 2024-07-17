const { Ollama } = require("ollama");

const AnswerParser = require("./AnswerParser");

// const ast = AnswerParser.parseSync("another ```javascript\nHello World``` So there is ```console.log()``` woudl y");

// console.log(ast);

// console.log("Code:");
// console.log(ast.codeBlocks.map(block => block.value));
// console.log();
// console.log("Text:");
// console.log(ast.textBlocks.map(block => block.value));

// console.log(
//   parse(
//     "```javascript\n" +
//     `console.log("Hello, world!");\n` +
//     "```",
//     "```javascript",
//     "```"
//   )
// );

// process.exit();

const DEFAULT_PROGRAMMING_LANGUAGE = "javascript";

const NO_ERRORS_DETECTED_MESSAGE = "No errors were detected in the provided source code.";

function prettifyProgrammingLanguageNameToken(
  name
) {
  name = name.toLowerCase();

  switch (name) {
    case "c": return "C";
    case "c++":
    case "cpp":
    case "cplusplus":
    case "c plus plus":
    case "c-plus-plus":
      return "C++";
    case "crystal": return "Crystal";
    case "java": return "Java";
    case "ecmascript":
    case "es6":
      return "ES6";
    default:
    case "js":
    case "javascript":
      return "JavaScript";
    case "node":
    case "nodejs":
    case "node.js":
      return "Node.js";
    case "ruby": return "Ruby";
    case "rust": return "Rust";
    case "ts":
    case "typescript":
        return "TypeScript";
  }
}

function prettifyProgrammingLanguageName(
  programmingLanguageName
) {
  const tokens = [];

  if (!programmingLanguageName.includes(" ")) return prettifyProgrammingLanguageNameToken(programmingLanguageName);

  for (const token of programmingLanguageName.split(" ")) tokens.push(prettifyProgrammingLanguageNameToken(token));

  return tokens.join(" ");
}

/**
 * The options to use when chatting with Code Goblin.
 *
 * @typedef {Object} ICodeGoblinChatOptions
 *
 * @property {Function} callback
 * The callback that is invoked for each new token as its generated.
 *
 * @property {"code" | "text"} mode
 * The mode to use when transforming responses.
 */

module.exports = class CodeGoblin {
  /**
   * @type {Ollama}
   */
  #ollama;

  /**
   * @type {"codellama" | "gemma2" | "mistral"}
   */
  #ollamaModel;

  constructor(
    options
  ) {
    options ??= {};

    const ollamaOptions = options.ollama ??= {};

    this.#ollamaModel = ollamaOptions.model ??= "gemma2";

    ollamaOptions.host ??= "127.0.0.1:11434";
    ollamaOptions.proxy ??= null;

    if (typeof ollamaOptions.host !== "string") delete ollamaOptions.host;
    if (typeof ollamaOptions.proxy !== "string") delete ollamaOptions.proxy;

    this.#ollama = new Ollama(
      {
        host: ollamaOptions.host,
        proxy: ollamaOptions.proxy
      }
    );
  }

  /**
   * Abort the current task.
   */
  abort() {
    this.#ollama.abort();
  }

  /**
   * Chat with the `CodeGoblin`.
   *
   * @param {string} prompt
   * The prompt to provide to the `CodeGoblin`.
   *
   * @param {*} options
   * A collection of options used to process the chat request.
   *
   * @returns {string}
   */
  async chat(
    prompt,
    options
  ) {
    options ??= {};

    const callback = options.callback ??= null;
    const mode = options.mode ??= "text";

    const ollama = this.#ollama;
    const model = this.#ollamaModel;

    const chatResponse = await ollama.chat(
      {
        model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        stream: true
      }
    );

    let currentLine = "";
    let line = "";
    let lineLowerCase = "";
    let lineType = "text";
    let message = "";

    let hasEncounteredSourceCode = false;
    let hasFoundProgrammingLanguage = false;
    let isAlreadyCorrect = false;
    let isNewLine = false;
    let isProgrammingLanguageNext = false;
    let remainingSkips = 0;
    let text = "";
    let tokenCount = 0;

    const toggleLineType = () => lineType = lineType === "text" ? "code" : "text";

    function isEndOfSentence(
      token
    ) {
      const delimiters = [
        ".",
        "?",
        "!"
      ];

      for (const delimiter of delimiters) if (token.includes(delimiter)) return true;

      return false;
    }

    for await (const tokenResponse of chatResponse) {
      tokenCount++;

      if (remainingSkips --> 0) continue;

      const token = tokenResponse.message.content;

      isNewLine = token.includes("\n");

      if (isNewLine && tokenCount === 1) {
        tokenCount--;

        continue;
      }

      if (token.includes("\n") || isEndOfSentence(token)) {
        line = (currentLine + token).trimEnd();
        lineLowerCase = line.toLowerCase();
        currentLine = "";
      } else currentLine += token;

      if (currentLine.length > 0) lineLowerCase = currentLine.toLowerCase();

      if (
        token.includes("correct") && (
          lineLowerCase.includes("actually correct") ||
          lineLowerCase.includes("already correct")
        )
      ) {
        isAlreadyCorrect = true;

        break;
      }

      if (token.includes("\n")) {
        if (line.includes("```")) toggleLineType();
        if (lineType === "text") text += line;
      }

      if (mode === "code") {
        if (isProgrammingLanguageNext) {
          if (token !== "\n") continue;

          isProgrammingLanguageNext = false;

          continue;
        }

        if (token.includes("\n")) {
          if (hasEncounteredSourceCode && lineLowerCase.includes("// example")) {
            message = message.substring(0, line.length - 1);

            break;
          }
        }

        if (token === "```") {
          if (hasFoundProgrammingLanguage) break;

          hasEncounteredSourceCode = hasFoundProgrammingLanguage = isProgrammingLanguageNext = true;

          continue;
        } else if (!hasEncounteredSourceCode) continue;
      }

      if (callback) await callback(
        {
          chatResponse,
          isNewLine,
          line,
          lineLowerCase,
          token
        }
      );

      message += token;
    }

    chatResponse.abort();

    if (isAlreadyCorrect) return NO_ERRORS_DETECTED_MESSAGE;

    if (!(text.includes("```"))) {
      text = text.trim();

      message = text;
    }

    return message.trim();
  }

  /**
   * Generate source code.
   *
   * @param {string} description
   * A description of the source code to generate.
   *
   * @param {*} options
   * The options used to generate source code.
   *
   * @returns {string}
   */
  async code(
    description,
    options
  ) {
    description ??= "";

    options ??= {};

    const callback = options.callback ??= null;

    let programmingLanguage = options.programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    description = description.trim();
    programmingLanguage = programmingLanguage.trim();

    const programmingLanguagePretty = prettifyProgrammingLanguageName(programmingLanguage);

    programmingLanguage = programmingLanguagePretty.toLowerCase();

    const prompt
      = "Please write "
      + programmingLanguagePretty
      + " source code.\n\n"
      + "Here is a description of what the source code should achieve:\n\n"
      + description;

    const chatOptions = {
      callback,
      mode: "code"
    };

    const answer = await this.chat(prompt, chatOptions);

    const correctedCode = AnswerParser.parseSync(answer).code;

    return correctedCode;
  }

  /**
   * Debug source code.
   *
   * @param {string} sourceCode
   * The source code to debug.
   *
   * @param {*} options
   * The options to use when debugging the source code.
   *
   * @returns {string}
   */
  async debug(
    sourceCode,
    options
  ) {
    options ??= {};

    let programmingLanguage = options.programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    const callback = options.callback ??= null;

    programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    if (typeof sourceCode === "function") {
      sourceCode = sourceCode.toString();

      programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE;
    }

    sourceCode = sourceCode.trim();

    const programmingLanguagePretty = prettifyProgrammingLanguageName(programmingLanguage);

    programmingLanguage = programmingLanguagePretty.toLowerCase();

    const prompt
      = "Please debug the following "
      + programmingLanguagePretty
      + " source code:\n\n```"
      + (programmingLanguage.includes(" ") ? programmingLanguage.split(" ")[0] : programmingLanguage)
      + "\n"
      + sourceCode
      + "\n```";

    const answer = await this.chat(prompt, { callback });

    if (answer === NO_ERRORS_DETECTED_MESSAGE) return sourceCode;
  }

  /**
   * Fix bugs in source code.
   *
   * @param {string} sourceCode
   * The source code to debug.
   *
   * @param {*} options
   * The options to use when debugging the source code.
   *
   * @returns {string}
   */
  async fix(
    sourceCode,
    options
  ) {
    options ??= {};

    let programmingLanguage = options.programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    const callback = options.callback ??= null;

    programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    if (typeof sourceCode === "function") {
      sourceCode = sourceCode.toString();

      programmingLanguage = "javascript";
    }

    sourceCode = sourceCode.trim();

    const programmingLanguagePretty = prettifyProgrammingLanguageName(programmingLanguage);

    programmingLanguage = programmingLanguagePretty.toLowerCase();

    const prompt
      = "Please correct the following "
      + programmingLanguagePretty
      + " source code:\n\n```"
      + (programmingLanguage.includes(" ") ? programmingLanguage.split(" ")[0] : programmingLanguage)
      + "\n"
      + sourceCode
      + "\n```";

    const chatOptions = {
      callback,
      mode: "code"
    };

    return await this.chat(prompt, chatOptions);
  }
};
