const { parseArgs } = require("util");

const PARSE_ARGS_OPTIONS = {
  analyze: {
    default: false,
    type: "boolean",
    short: "a"
  },
  chat: {
    default: false,
    type: "boolean",
    short: "C"
  },
  code: {
    default: false,
    type: "boolean",
    short: "c"
  },
  debug: {
    default: false,
    type: "boolean",
    short: "d"
  },
  fix: {
    default: false,
    type: "boolean",
    short: "f"
  },
  input: {
    type: "string",
    short: "i"
  },
  language: {
    default: "javascript",
    type: "string",
    short: "l"
  },
  model: {
    default: "gemma2",
    type: "string",
    short: "m"
  },
  output: {
    type: "string",
    short: "o"
  },
  port: {
    type: "string",
    short: "p"
  }
};

const args = parseArgs(
  {
    allowPositionals: true,
    args: process.argv.splice(2),
    options: PARSE_ARGS_OPTIONS,
    strict: false
  }
);

if (
  !(args.values.analyze) ||
  !(args.values.code) ||
  !(args.values.debug) ||
  !(args.values.fix)
) {
  args.values.chat = true;
}

Object.freeze(args);

module.exports = args;
