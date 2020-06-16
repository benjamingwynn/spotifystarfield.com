/** @format */

if ("WakeLock" in window && "request" in window.WakeLock) {
	let wakeLock = null

	const requestWakeLock = () => {
		const controller = new AbortController()
		const signal = controller.signal
		window.WakeLock.request("screen", {signal})
		console.log("Wake Lock is active")
		return controller
	}

	const handleVisibilityChange = () => {
		if (wakeLock !== null && document.visibilityState === "visible") {
			wakeLock = requestWakeLock()
		}
	}

	document.addEventListener("visibilitychange", handleVisibilityChange)
	document.addEventListener("fullscreenchange", handleVisibilityChange)

	wakeLock = requestWakeLock()
} else if ("wakeLock" in navigator && "request" in navigator.wakeLock) {
	let wakeLock = null

	const requestWakeLock = async () => {
		try {
			wakeLock = await navigator.wakeLock.request("screen")
			console.log("Wake Lock is active")
		} catch (e) {
			console.error(`${e.name}, ${e.message}`)
		}
	}

	const handleVisibilityChange = () => {
		if (wakeLock !== null && document.visibilityState === "visible") {
			requestWakeLock()
		}
	}

	document.addEventListener("visibilitychange", handleVisibilityChange)
	document.addEventListener("fullscreenchange", handleVisibilityChange)

	requestWakeLock()
} else {
	console.error("Wake Lock API not supported.")
}
