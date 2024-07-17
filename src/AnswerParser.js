const TRIPLE_BACKTICK = "```";

module.exports = class AnswerParser {
  constructor() {
  }

  static parseSync(
    answer
  ) {
    answer = answer.trim();

    const blocks = [];
    const codeBlocks = [];
    const textBlocks = [];

    let remaining = answer;

    while (remaining.includes(TRIPLE_BACKTICK)) {
      let split = remaining.split(TRIPLE_BACKTICK);

      let text = split[0];

      const originalText = text;

      text = text.trim();

      if (originalText.length > 0) {
        const naturalLanguage = null;

        const textBlock = {
          type: "TextBlock",
          naturalLanguage,
          value: text
        };

        blocks.push(textBlock);
        textBlocks.push(textBlock);
      }

      if (split.length < 3) break;

      remaining = remaining.substring(originalText.length + TRIPLE_BACKTICK.length);

      // console.log(remaining + "\n");

      if (remaining.length <= 0) break;

      split = remaining.split(TRIPLE_BACKTICK);

      let code = split[0];
      const naturalLanguage = null;
      let programmingLanguage = null;

      const originalCode = code;

      code = code.trim();

      if (code.includes("\n")) {
        const codeSplit = code.split(" ");

        if (codeSplit.length > 0 && codeSplit[0].includes("\n")) {
          programmingLanguage = codeSplit[0].split("\n")[0];

          if (programmingLanguage.length > 0) code = code.substring(programmingLanguage.length + 1);
        }
      }

      const codeBlock = {
        type: "CodeBlock",
        naturalLanguage,
        programmingLanguage,
        value: code
      };

      blocks.push(codeBlock);
      codeBlocks.push(codeBlock);

      if (remaining.length <= 0) break;

      remaining = remaining.substring(originalCode.length + TRIPLE_BACKTICK.length).trim();
    }

    if (remaining.startsWith(TRIPLE_BACKTICK)) remaining = remaining.substring(3).trim();

    const remainingBlock = {
      type: "TextBlock",
      naturalLanguage: null,
      value: remaining
    };

    if (remaining && remaining.length > 0) textBlocks.push(remainingBlock);

    remaining = "";

    const code = codeBlocks.map(block => block.value).join("\n\n");
    const text = textBlocks.map(block => block.value).join("\n\n");

    return {
      string: answer,
      blocks,
      code,
      codeBlocks,
      text,
      textBlocks
    };
  }
};
