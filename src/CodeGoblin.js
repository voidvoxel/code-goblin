const { Ollama } = require("ollama");

const AnswerParser = require("./AnswerParser");

const DEFAULT_PROGRAMMING_LANGUAGE = "javascript";

const DEFAULT_MESSAGE = "Code Goblin is unable to process this request.";

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

/**
 * Code Goblin is an A.I. assistant for software engineering.
 */
module.exports = class CodeGoblin {
  /**
   * @type {Ollama}
   */
  #ollama;

  /**
   * @type {string}
   */
  #ollamaModel;

  constructor(
    options
  ) {
    options ??= {};

    const ollamaOptions = options.ollama ??= {};

    this.#ollamaModel = ollamaOptions.model ??= "mistral";

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
   * @param {ICodeGoblinChatOptions} options
   * A collection of options used to process the chat request.
   *
   * @returns {string}
   */
  chat(
    prompt,
    options
  ) {
    return new Promise(
      (resolve, reject) => {
        options ??= {};

        const callback = options.callback ??= null;
        const mode = options.mode ??= "text";
        const timeout = options.timeout ??= Infinity;

        const ollama = this.#ollama;
        const model = this.#ollamaModel;

        if (timeout && isFinite(timeout) && timeout > 0) setTimeout(
          () => resolve(DEFAULT_MESSAGE),
          timeout
        );

        ollama.chat(
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
        ).then(
          chatResponse => this.#chat(chatResponse, callback, mode, resolve, reject)
        );
      }
    )
  }

  async #chat(
    chatResponse,
    callback,
    mode,
    resolve,
    reject
  ) {
    try {
      let currentLine = "";
      let line = "";
      let lineLowerCase = "";
      let message = "";

      let hasEncounteredSourceCode = false;
      let hasFoundProgrammingLanguage = false;
      let isAlreadyCorrect = false;
      let isNewLine = false;
      let isProgrammingLanguageNext = false;
      let remainingSkips = 0;
      let text = "";
      let tokenCount = 0;

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
          lineLowerCase.includes("actually correct") ||
          lineLowerCase.includes("already correct") ||
          lineLowerCase.includes("cannot provide") ||
          lineLowerCase.includes("can't provide") ||
          lineLowerCase.includes("unable to provide")
        ) {
          isAlreadyCorrect = true;

          break;
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

      if (isAlreadyCorrect) resolve(DEFAULT_MESSAGE);

      resolve(message);
    } catch (error) {
      reject(error.message);
    }
  }

  /**
   * Analyze source code.
   *
   * @param {string} sourceCode
   * The source code to analyze.
   *
   * @param {ICodeGoblinChatOptions} options
   * The options to use when analyzing the source code.
   *
   * @returns {string}
   */
  async analyze(
    sourceCode,
    options
  ) {
    options ??= {};

    let programmingLanguage = options.programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    const callback = options.callback ??= null;
    const timeout = options.timeout ??= null;

    programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    if (typeof sourceCode === "function") {
      sourceCode = sourceCode.toString();

      programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE;
    }

    sourceCode = sourceCode.trim();

    const programmingLanguagePretty = prettifyProgrammingLanguageName(programmingLanguage);

    programmingLanguage = programmingLanguagePretty.toLowerCase();

    let prompt
      = "Please analyze and explain the following "
      + programmingLanguagePretty
      + " source code:\n\n```"
      + (programmingLanguage.includes(" ") ? programmingLanguage.split(" ")[0] : programmingLanguage)
      + "\n"
      + sourceCode
      + "\n```";

    if (typeof options.error !== "string") options.error = "";

    const errorText = options.error;

    if (errorText && errorText.length > 0) prompt += "\n\nRunning the above source code produces the following error:\n\n" + errorText;

    const answer = await this.chat(prompt, { callback, timeout });

    if (answer === DEFAULT_MESSAGE) return sourceCode;
  }

  /**
   * Debug source code.
   *
   * @param {string} sourceCode
   * The source code to debug.
   *
   * @param {ICodeGoblinChatOptions} options
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
    const timeout = options.timeout ??= null;

    programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    if (typeof sourceCode === "function") {
      sourceCode = sourceCode.toString();

      programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE;
    }

    sourceCode = sourceCode.trim();

    const programmingLanguagePretty = prettifyProgrammingLanguageName(programmingLanguage);

    programmingLanguage = programmingLanguagePretty.toLowerCase();

    let prompt
      = "Please debug the following "
      + programmingLanguagePretty
      + " source code:\n\n```"
      + (programmingLanguage.includes(" ") ? programmingLanguage.split(" ")[0] : programmingLanguage)
      + "\n"
      + sourceCode
      + "\n```";

    if (typeof options.error !== "string") options.error = "";

    const errorText = options.error;

    if (errorText && errorText.length > 0) prompt += "\n\nHere is the error:\n\n" + errorText;

    const answer = await this.chat(prompt, { callback, timeout });

    if (answer === DEFAULT_MESSAGE) return sourceCode;
  }

  /**
   * Fix bugs in source code.
   *
   * @param {string} sourceCode
   * The source code to debug.
   *
   * @param {ICodeGoblinChatOptions} options
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
    const timeout = options.timeout ??= null;

    programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    if (typeof sourceCode === "function") {
      sourceCode = sourceCode.toString();

      programmingLanguage = "javascript";
    }

    sourceCode = sourceCode.trim();

    const programmingLanguagePretty = prettifyProgrammingLanguageName(programmingLanguage);

    programmingLanguage = programmingLanguagePretty.toLowerCase();

    let prompt
      = "Please correct the following "
      + programmingLanguagePretty
      + " source code:\n\n```"
      + (programmingLanguage.includes(" ") ? programmingLanguage.split(" ")[0] : programmingLanguage)
      + "\n"
      + sourceCode
      + "\n```";

    if (typeof options.error !== "string") options.error = "";

    const errorText = options.error;

    if (errorText && errorText.length > 0) prompt += "\n\nHere is the error:\n\n" + errorText;

    const chatOptions = {
      callback,
      mode: "code",
      timeout
    };

    return await this.chat(prompt, chatOptions);
  }

  /**
   * Generate source code.
   *
   * @param {string} description
   * A description of the source code to generate.
   *
   * @param {ICodeGoblinChatOptions} options
   * The options used to generate source code.
   *
   * @returns {string}
   */
  async generate(
    description,
    options
  ) {
    description ??= "";

    options ??= {};

    const callback = options.callback ??= null;
    const timeout = options.timeout ??= null;

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
      mode: "code",
      timeout
    };

    const answer = await this.chat(prompt, chatOptions);

    const correctedCode = AnswerParser.parseSync(answer).code;

    return correctedCode;
  }

  /**
   * Summarize source code.
   *
   * @param {string} sourceCode
   * The source code to analyze.
   *
   * @param {ICodeGoblinChatOptions} options
   * The options to use when analyzing the source code.
   *
   * @returns {string}
   */
  async summarize(
    sourceCode,
    options
  ) {
    options ??= {};

    let programmingLanguage = options.programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    const callback = options.callback ??= null;
    const timeout = options.timeout ??= null;

    programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    if (typeof sourceCode === "function") {
      sourceCode = sourceCode.toString();

      programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE;
    }

    sourceCode = sourceCode.trim();

    const programmingLanguagePretty = prettifyProgrammingLanguageName(programmingLanguage);

    programmingLanguage = programmingLanguagePretty.toLowerCase();

    let prompt
      = "Please summarize the meaning of the following "
      + programmingLanguagePretty
      + " source code:\n\n```"
      + (programmingLanguage.includes(" ") ? programmingLanguage.split(" ")[0] : programmingLanguage)
      + "\n"
      + sourceCode
      + "\n```";

    if (typeof options.error !== "string") options.error = "";

    const errorText = options.error;

    if (errorText && errorText.length > 0) prompt += "\n\nRunning the above source code produces the following error:\n\n" + errorText;

    const answer = await this.chat(prompt, { callback, timeout });

    if (answer === DEFAULT_MESSAGE) return sourceCode;
  }

  /**
   * Translate source code from one programming language to another.
   *
   * @param {string} sourceCode
   * The source code to analyze.
   *
   * @param {ICodeGoblinChatOptions} options
   * The options to use when analyzing the source code.
   *
   * @returns {string}
   */
  async translate(
    sourceCode,
    options
  ) {
    options ??= {};

    let programmingLanguage = options.programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;
    let inputProgrammingLanguage = options.inputProgrammingLanguage ??= null;

    const callback = options.callback ??= null;
    const timeout = options.timeout ??= null;

    programmingLanguage ??= DEFAULT_PROGRAMMING_LANGUAGE;

    if (typeof sourceCode === "function") {
      sourceCode = sourceCode.toString();

      programmingLanguage = DEFAULT_PROGRAMMING_LANGUAGE;
    }

    sourceCode = sourceCode.trim();

    const programmingLanguagePretty = prettifyProgrammingLanguageName(programmingLanguage);

    programmingLanguage = programmingLanguagePretty.toLowerCase();

    let prompt
      = "Please rewrite the following"
      // + (
      //   inputProgrammingLanguage ? (
      //     " " + prettifyProgrammingLanguageName(inputProgrammingLanguage)
      //   ) : ""
      // )
      + " code snippet in the "
      + programmingLanguagePretty;

    prompt += " programming language. The response should only contain a single code snippet of " + programmingLanguagePretty + " and nothing else.\n\n```"
      + (
        !!inputProgrammingLanguage
          ? (inputProgrammingLanguage.includes(" ") ? inputProgrammingLanguage.split(" ")[0] : inputProgrammingLanguage)
          : ""
    )
      + "\n"
      + sourceCode
      + "\n```";

    if (typeof options.error !== "string") options.error = "";

    const errorText = options.error;

    if (errorText && errorText.length > 0) prompt += "\n\nRunning the above source code produces the following error:\n\n" + errorText;

    const answer = await this.chat(prompt, { callback, mode: "code", timeout });

    if (answer === DEFAULT_MESSAGE) return sourceCode;
  }
};
