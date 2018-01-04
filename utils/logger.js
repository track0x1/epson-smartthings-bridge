const chalk = require('chalk')
const fs = require('fs')

/**
 * Simple logger for the application.
 */
const logger = {
  error(...msg) {
    this.log(chalk.red(...msg));
    fs.appendFileSync('error.log', '\n' + msg.join(' '))
  },
  info(...msg) {
    this.log(chalk.green(...msg));
  },
  test(...msg) {
    this.log(chalk.magenta(...msg));
  },
  log(...msg) {
    const now = new Date();
    console.log(chalk.bold('[epson-smartthings-bridge]'), chalk.dim(now.toLocaleString()), ...msg)
  }
}

module.exports = logger;
