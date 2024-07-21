const { Ollama } = require("ollama");

const DEFAULT_LANGUAGE = "en";

const DEFAULT_MESSAGE = "Goblln is unable to process this request.";

function prettifyLanguageNameToken(
  name
) {
  name = name.toLowerCase();

  switch (name) {
    default:
    case "en": return "English";
    case "en-us": return "United States English";
    case "en-uk": return "United Kingdom English";
    case "es": return "Spanish";
    case "ru": return "Russian";
    case "jp": return "Japanese";
    case "ck": return "Chinese";
    // TODO: Add more
  }
}

function prettifyLanguageName(
  programmingLanguageName
) {
  const tokens = [];

  if (!programmingLanguageName.includes(" ")) return prettifyLanguageNameToken(programmingLanguageName);

  for (const token of programmingLanguageName.split(" ")) tokens.push(prettifyLanguageNameToken(token));

  return tokens.join(" ");
}

/**
 * The options to use when chatting with Goblln.
 *
 * @typedef {Object} IGobllnChatOptions
 *
 * @property {Function} callback
 * The callback that is invoked for each new token as its generated.
 */

/**
 * Goblln is an LLM library for Node.js.
 */
module.exports = class Goblln {
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
   * Chat with the `Goblln`.
   *
   * @param {string} prompt
   * The prompt to provide to the `Goblln`.
   *
   * @param {IGobllnChatOptions} options
   * A collection of options used to process the chat request.
   *
   * @returns {Promise<string>}
   */
  chat(
    prompt,
    options
  ) {
    return new Promise(
      (resolve, reject) => {
        options ??= {};

        const callback = options.callback ??= null;
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
          chatResponse => this.#chat(chatResponse, callback, resolve, reject)
        );
      }
    )
  }

  async #chat(
    chatResponse,
    callback,
    resolve,
    reject
  ) {
    try {
      let line = "";
      let lineLowerCase = "";
      let message = "";

      let isAlreadyCorrect = false;
      let isNewLine = false;
      let remainingSkips = 0;
      let tokenCount = 0;

      for await (const tokenResponse of chatResponse) {
        tokenCount++;

        if (remainingSkips --> 0) continue;

        const token = tokenResponse.message.content;

        isNewLine = token.includes("\n");

        if (isNewLine && tokenCount === 1) {
          tokenCount--;

          continue;
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
   * Analyze content.
   *
   * @param {string} input
   * The content to analyze.
   *
   * @param {IGobllnChatOptions} options
   * The options to use when analyzing the content.
   *
   * @returns {string}
   */
  async analyze(
    input,
    options
  ) {
    options ??= {};

    const callback = options.callback ??= null;
    const timeout = options.timeout ??= null;

    input = input.trim();

    let prompt
      = "Please analyze the following:\n\n```"
      + "\n"
      + input
      + "\n```";

    const answer = await this.chat(prompt, { callback, timeout });

    if (answer === DEFAULT_MESSAGE) return input;
  }

  /**
   * Fix any issues present in the provided content.
   *
   * @param {string} content
   * The content to fix.
   *
   * @param {IGobllnChatOptions} options
   * The options to use when debugging the content.
   *
   * @returns {string}
   */
  async fix(
    content,
    options
  ) {
    options ??= {};

    const callback = options.callback ??= null;
    const timeout = options.timeout ??= null;

    content = content.trim();

    let prompt
      = "Please read the following and correct any typos or grammatical mistakes:\n\n```"
      + "\n"
      + content
      + "\n```";

    if (typeof options.error !== "string") options.error = "";

    const errorText = options.error;

    if (errorText && errorText.length > 0) prompt += "\n\nHere is the error:\n\n" + errorText;

    const chatOptions = {
      callback,
      timeout
    };

    return await this.chat(prompt, chatOptions);
  }

  /**
   * Generate a response from a description.
   *
   * @param {string} description
   * A description of the content to generate.
   *
   * @param {IGobllnChatOptions} options
   * The options used to generate a response.
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

    description = description.trim();

    const prompt
      = "Please output "
      + description;

    const chatOptions = {
      callback,
      timeout
    };

    const answer = await this.chat(prompt, chatOptions);

    return answer;
  }

  /**
   * Summarize content.
   *
   * @param {string} content
   * The content to analyze.
   *
   * @param {IGobllnChatOptions} options
   * The options to use when analyzing the content.
   *
   * @returns {string}
   */
  async summarize(
    content,
    options
  ) {
    options ??= {};

    const callback = options.callback ??= null;
    const timeout = options.timeout ??= null;

    content = content.trim();

    let prompt
      = "Please summarize the following:\n\n```md\n"
      + content
      + "\n```";

    if (typeof options.error !== "string") options.error = "";

    const answer = await this.chat(prompt, { callback, timeout });

    if (answer === DEFAULT_MESSAGE) return content;
  }

  /**
   * Translate content from one language to another.
   *
   * @param {string} content
   * The content to analyze.
   *
   * @param {IGobllnChatOptions} options
   * The options to use when analyzing the content.
   *
   * @returns {string}
   */
  async translate(
    content,
    options
  ) {
    options ??= {};

    let language = options.language ??= DEFAULT_LANGUAGE;
    let inputLanguage = options.inputLanguage ??= null;

    const callback = options.callback ??= null;
    const timeout = options.timeout ??= null;

    language ??= DEFAULT_LANGUAGE;

    if (typeof content === "function") {
      content = content.toString();

      language = DEFAULT_LANGUAGE;
    }

    content = content.trim();

    const languagePretty = prettifyLanguageName(language);

    language = languagePretty.toLowerCase();

    let prompt
      = "Please rewrite the following"
      + " document in "
      + languagePretty;

    prompt += ".\n\n```md\n"
      + content
      + "\n```";

    const answer = await this.chat(prompt, { callback, timeout });

    if (answer === DEFAULT_MESSAGE) return content;

    return answer;
  }
};
