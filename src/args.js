const { parseArgs } = require("util");

const PARSE_ARGS_OPTIONS = {
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

Object.freeze(args);

module.exports = args;
