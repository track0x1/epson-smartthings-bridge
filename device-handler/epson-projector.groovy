/**
 * Epson Powerlite Projector Device Handler
 *
 * Copyright 2018 Tom Beute
 */
metadata {
	definition (name: "Epson Projector", namespace: "track0x1", author: "Tom Beute") {
		capability "Switch"
		capability "Refresh"
		capability "Sensor"
	}

	tiles(scale: 2) {
		standardTile("switch", "device.switch", width: 6, height: 4, canChangeIcon: true) {
			state "on", label: 'On', action: "switch.off", icon: "st.Electronics.electronics7", backgroundColor: "#00A0DC", nextState: "turningOff"
			state "off", label: 'Off', action: "switch.on", icon: "st.Electronics.electronics7", backgroundColor: "#ffffff", nextState: "turningOn"
			state "turningOn", label: 'Turning On', action: "switch.off", icon: "st.Electronics.electronics7", backgroundColor: "#72CAEB", nextState: "turningOff"
			state "turningOff", label: 'Turning Off', action: "switch.on", icon: "st.Electronics.electronics7", backgroundColor: "#72CAEB", nextState: "turningOn"
			state "offline", label: "Offline", action:"switch.on", icon:"st.Electronics.electronics7", backgroundColor:"#cccccc", nextState:"turningOn"
		}

    valueTile("lamp", "device.lamp", decoration: "flat", width: 2, height: 2) {
      state "lamp", label: '${currentValue} \n Lamp Hours'
		}
		standardTile("refresh", "device.refresh", inactiveLabel: false, decoration: "flat", width: 2, height: 2) {
			state "default", action: "refresh.refresh", icon: "st.secondary.refresh"
		}

		main("switch")
		details("switch", "pi", "lamp", "refresh")
	}
}
preferences {
	input("hubIP", "text", title: "Hub IP", required: true, displayDuringSetup: true)
}

def installed() {
	updated()
}

def updated() {
	unschedule()
	runEvery15Minutes(refresh)
	runIn(2, refresh)
}

def on() {
	sendCmdtoServer("turnOn", "onOffResponse")
}

def off() {
	sendCmdtoServer("turnOff", "onOffResponse")
}

def onOffResponse(response){
	if (response.headers["res-command"] == "failure") {
		log.error "$device.name $device.label: Bridge failure"
		sendEvent(name: "switch", value: "offline", descriptionText: "ERROR - Bridge failed to execute command", isStateChange: true)
	}
	// Wait for projector to complete turning on/off before sending more commands
  state.pendingRefresh = true
	runIn(60, clearPendingRefresh)
}

def clearPendingRefresh() {
	state.pendingRefresh = false
  refresh()
}

def refresh(){
	if (state.pendingRefresh) {
		return
	}
	sendCmdtoServer("getStatus", "refreshResponse")
}

def refreshResponse(response){
	if (response.headers["res-command"] == "failure") {
		log.error "$device.name $device.label: Bridge failure"
		sendEvent(name: "switch", value: "offline", descriptionText: "Communication error", isStateChange: true)
	} else {
		def cmdResponse = parseJson(response.headers["res-command"])
		def status = cmdResponse.projector.state
		if (status == "01") {
			status = "on"
		} else {
			status = "off"
		}
		log.info "${device.name} ${device.label}: Power: ${status}"
		sendEvent(name: "switch", value: status)
		sendCmdtoServer("getLampHours", "refreshLampHours")
	}
}

def refreshLampHours(response){
	def cmdResponse = parseJson(response.headers["res-command"])
	def hours = cmdResponse.projector.lamp_hours
	log.info "${device.name} ${device.label}: Lamp Hours: ${hours}"
	sendEvent(name: "lamp", value: hours, descriptionText: "Lamp Hours:  ${hours}")
}

private sendCmdtoServer(hubCommand, action){
	def headers = [:]
	headers.put("HOST", "$hubIP:8123")
	headers.put("req-command", hubCommand)
	sendHubCommand(new physicalgraph.device.HubAction(
		[headers: headers],
		device.deviceNetworkId,
		[callback: action]
	))
}
