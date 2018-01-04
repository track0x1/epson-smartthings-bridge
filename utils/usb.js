const usb = require('usb')
const logger = require('./logger')

const EPSON_VENDOR_ID = 0x04b8

/**
 * Class for interacting with the projector via USB
 */
class USBInterface {
  constructor() {
    this.projector = undefined
    this.isConnected = false
    this.initialize()
  }

  /**
   * Initialize with USB attach and detach handlers.
   */
  initialize() {
    logger.log('waiting for projector to be connected via USB...')
    usb.on('attach', (device) => {
      // We're going to assume that the only Epson device you have connected via USB is the projector
      if (device.deviceDescriptor.idVendor === EPSON_VENDOR_ID) {
        this.connect(device)
      }
    })
    usb.on('detach', (device) => {
      if (device.deviceDescriptor.idVendor === EPSON_VENDOR_ID) {
        this.disconnect(device)
      }
    })
  }

  /**
   * Open communication to projector
   * @return {Void}
   */
  connect(device) {
    logger.info('connection to projector opened!')
    this.projector = device
    this.projector.timeout = 1000 // Set default timeout for control transfers
    this.isConnected = true
    device.open()
  }

  /**
   * Disconnect from projector
   * @return {Void}
   */
  disconnect(device) {
    if (!this.isConnected) {
      return
    }

    logger.info('connection to projector closed!')
    this.projector = undefined
    this.isConnected = false
    device.close()
  }

  /**
   * Send a command to the projector (LIBUSB_TRANSFER_TYPE_BULK)
   * @param  {String}  cmd Raw command to send to the projector, excluding carriage return.
   * @return {Promise}
   */
  sendCommand(cmd) {
    if (!this.isConnected) {
      return Promise.reject('unable to execute command. you need to connect to the projector first.')
    }

    // OutEndpoint
    const outInterface = this.projector.interfaces[2]

    // Ensure that kernel driver has been detached so we can interact with the projector
    if (outInterface.isKernelDriverActive()) {
      outInterface.detachKernelDriver()
    }

    // Claim interface
    outInterface.claim()

    // Imitation file descriptor
    const fd = outInterface.endpoint(2)

    // Set timeout to 5s so we don't wait forever
    fd.timeout = 5000

    return new Promise((resolve, reject) => {
      const isRequestCmd = cmd.indexOf('?') > -1

      fd.transfer(`${cmd}\r`, (cmdErr) => {
        // Always release interface when done
        outInterface.release((releaseErr) => {
          if (cmdErr) {
            return reject(new Error(`error sending command ${cmd}`))
          }
          if (releaseErr) {
            logger.error('error releasing send interface\n', releaseErr)
          }

          // Resolve with nothing (Set command), or another promise (Get command)
          return resolve(isRequestCmd ? this.receiveCommand(cmd) : undefined)
        })
      })
    })
  }

  /**
   * Receive message from the projector (LIBUSB_TRANSFER_TYPE_CONTROL)
   * @param  {String}  cmd Raw command that was sent to projector, excluding carriage return.
   * @return {Promise}
   */
  receiveCommand(cmd) {
    if (!this.isConnected) {
      return Promise.reject('unable to receieve message. you need to connect to the projector first.')
    }

    return new Promise((resolve, reject) => {
      this.projector.controlTransfer(0xC0, 0x02, 0x0000, 0x0000, 12, (err, data) => {
        if (err) {
          return reject(new Error(`error receiving data from projector`))
        }

        // Data comes in 'COMMAND=PARAMETER\r:' format (as a buffer)
        const dataStr = data.toString();
        const parsedStr = dataStr.substr(0, dataStr.indexOf('\r')).split('=')

        return resolve(parsedStr)
      })
    }).then((data) => {
      // If data is empty or doesnt match our sent command, retry tx/rx.
      if (!data[0] || cmd.indexOf(data[0]) < 0) {
        // Retry after 2 seconds (otherwise it will overwhelm the projector)
       return new Promise((resolve) => {
         setTimeout(() => resolve(this.sendCommand(cmd)), 2000)
       })
      }

      // Only return the value since we know the type (because we requested for it)
      return data[1]
    })
  }
}

module.exports = USBInterface
