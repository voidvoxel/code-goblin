const readline = require('readline');

async function readStdin() {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let inputString = '';

    rl.on('line', (line) => {
      inputString += line;
    });

    rl.on('close', () => {
      resolve(inputString);
    });
  });
}

// Example usage: