const bridgePort = 8123

const http = require('http')
const logger = require('./utils/logger')
const USB = require('./utils/usb')
const commands = require('./constants/projector')

let USBInterface;

logger.log('node.js version: ' + process.version)

http.createServer(handleRequest).listen(bridgePort, (err) => {
  if (err) logger.error(err)
  else {
    logger.info(`server is now running on port ${bridgePort}!`)
    USBInterface = new USB();
  }
})

function handleRequest(req, res){
  const command = req.headers['req-command']

  logger.log(`received request for command: '${command}'`)

  switch(command) {
    case 'getStatus':
      getProjectorStatus(res)
      break

    case 'getLampHours':
      getLampHours(res)
      break

    case 'turnOn':
      toggleProjector(true, req, res)
      break

    case 'turnOff':
      toggleProjector(false, req, res)
      break

    default:
      res.end()
      logger.error(`request for invalid command`)
  }
}

/**
 * Returns the power status of the projector.
 */
function getProjectorStatus(res) {
  USBInterface.sendCommand(commands.STATUS)
  .then((value) => {
    const pwrStatus = { projector: { state: value }}
    logger.log(`projector status: ${value}`)
    res.setHeader('res-command', JSON.stringify(pwrStatus))
    res.end()
  })
  .catch((err) => {
    logger.error(err)
    res.setHeader('res-command', 'failure')
    res.end()
  })
}

/**
 * Returns the total lamp hours of projector bulb.
 */
function getLampHours(res) {
  USBInterface.sendCommand(commands.LAMP_HOURS)
  .then((value) => {
    const lampHours = { projector: { lamp_hours: value }}
    logger.log(`lamp hours: ${value}`)
    res.setHeader('res-command', JSON.stringify(lampHours))
    res.end()
  })
  .catch((err) => {
    logger.error(err)
    res.setHeader('res-command', 'failure')
    res.end()
  })
}

/**
 * Send command to turn on/off projector.
 */
function toggleProjector(turnOn, req, res) {
  const actualCmd = turnOn ? commands.ON : commands.OFF
  const nextState = turnOn ? 1 : 0

  USBInterface.sendCommand(actualCmd)
  .then(() => {
    logger.log(`projector on? ${!!nextState}`)
    res.setHeader('res-command', 'success')
    res.end()
  })
  .catch((err) => {
    logger.error(err)
    res.setHeader('res-command', 'failure')
    res.end()
  })
}
