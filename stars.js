/**
 * this is bad
 *
 * @format */
"use strict"
;(function () {
	// Configurable options
	const STAR_RADIUS = 1
	let MIN_CONNECTION_RADIUS = 60
	let MAX_CONNECTION_RADIUS = 200
	const FADE_OUT_PADDING = 100
	let maximumStarPopulation = 200
	let drawDebug = false
	let starMinSpeed = 1.5
	let starMaxSpeed = 1.7
	let worldSpeed = 0.5
	let maxConnectionStars = 70
	let showKeyboardShortcuts = false

	const BEAT_STRENGTH = 15
	const BEAT_RESISTANCE = 3
	const BEAT_MIN_CONFIDENCE = 0.45

	const COLORS = [
		// 0 = C, 1 = C♯/D♭, 2 = D, and so on
		["255,47,146", "255,49,148", "255,51,150"],
		["255,126,121"],
		["255,212,121"],
		["255,252,121"],
		["212,251,121"],
		["115,250,121"],
		["115,252,214"],
		["115,253,255"],
		["118,214,255"],
		["122,129,255"],
		["215,131,255"],
		["255,133,255"],
	]

	// Variables

	let lastT = 0
	let scale, left, right, bottom, top
	let nStars = 0
	let nConnectionStars = 0
	let nLines = 0
	let segment
	let section
	let startTime
	let currentTrackID
	const stars = []
	const connectionStars = []

	let lastWidth = window.innerWidth,
		lastHeight = window.innerHeight

	const hashFragment = location.hash
		.substr(1)
		.split("&")
		.reduce((hash, x) => {
			hash[x.split("=")[0]] = x.split("=")[1]
			return hash
		}, {})

	// Stuff on the document

	const canvas = document.getElementById("stars")
	const ctx = canvas.getContext("2d")
	const $playerMeta = document.querySelector("#player-meta")
	const $playerTime = document.querySelector("#player-time")

	const token = hashFragment.access_token

	const configure = () => {
		const box = canvas.getBoundingClientRect()
		const width = box.width
		const height = box.height
		scale = window.devicePixelRatio || 1
		canvas.width = Math.floor(width * scale)
		canvas.height = Math.floor(height * scale)

		//Math.max(3, Math.floor(canvas.width * canvas.height * CONNECTION_STAR_DENSITY))

		left = 0
		right = canvas.width
		bottom = canvas.height
		top = 0

		// Normalize coordinate system to use css pixels (see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
		ctx.scale(scale, scale)
	}

	const addStar = ({px, py, vx = generateStarSpeed(), vy = generateStarSpeed(), connectionRadius}) => {
		if (!section) debugger //. don't add a star if not running on a section yet!
		const star = {px, py, vx, vy, connectionRadius, color: COLORS[section ? section.key : 0][Math.floor(Math.random() * COLORS[section ? section.key : 0].length)]}
		stars.push(star)
		nStars++
		return star
	}

	const secretKeyboardShortcutLines = secretKeyboardShortcuts.toString().split("\n")
	const draw = (t) => {
		if (!segment) {
			// don't draw if there's no valid section selected
			requestAnimationFrame(draw)
			return
		}
		const deltaT = t - lastT
		const lagModifier = deltaT / 16.67

		nLines = 0
		canvas.width = canvas.width // this clears the canvas

		for (let i = nStars - 1; i >= 0; i--) {
			const star = stars[i]
			star.px += star.vx * worldSpeed * lagModifier
			star.py += star.vy * worldSpeed * lagModifier

			if (star.extraSpeedY || star.extraSpeedX) {
				if (star.extraSpeedX > 0) {
					star.extraSpeedX = Math.max(star.extraSpeedX - star.extraSpeedResistance * worldSpeed * lagModifier, 0)
					// star.extraSpeedX = Math.max(star.extraSpeedX, 0)
				} else if (star.extraSpeedX < 0) {
					star.extraSpeedX = Math.min(star.extraSpeedX + star.extraSpeedResistance * worldSpeed * lagModifier, 0)
				}

				if (star.extraSpeedY > 0) {
					star.extraSpeedY = Math.max(star.extraSpeedY - star.extraSpeedResistance * worldSpeed * lagModifier, 0)
				} else if (star.extraSpeedY < 0) {
					star.extraSpeedY = Math.min(star.extraSpeedY + star.extraSpeedResistance * worldSpeed * lagModifier, 0)
				}

				star.px += star.extraSpeedX * worldSpeed * lagModifier
				star.py += star.extraSpeedY * worldSpeed * lagModifier
			}

			// remove from loop if out of bounds
			if (star.px + STAR_RADIUS > right || star.px - STAR_RADIUS < left || star.py + STAR_RADIUS > bottom || star.py - STAR_RADIUS < top) {
				if (star.connectionRadius) {
					for (let csi = nConnectionStars - 1; csi >= 0; csi--) {
						if (connectionStars[csi] === star) {
							connectionStars.splice(csi, 1)
							continue
						}
					}
					nConnectionStars--
				}
				stars.splice(i, 1)
				nStars--
				continue
			}

			let alpha = 1

			// find the distance from the closest edge
			if (star.px < FADE_OUT_PADDING) {
				alpha = Math.min(alpha, star.px / FADE_OUT_PADDING)
			}

			if (star.py < FADE_OUT_PADDING) {
				alpha = Math.min(alpha, star.py / FADE_OUT_PADDING)
			}

			const rightAlphaEdge = canvas.width - FADE_OUT_PADDING
			if (star.px > rightAlphaEdge) {
				alpha = 1 - (star.px - rightAlphaEdge) / (canvas.width - rightAlphaEdge)
			}
			const bottomAlphaEdge = canvas.height - FADE_OUT_PADDING
			if (star.py > bottomAlphaEdge) {
				alpha = 1 - (star.py - bottomAlphaEdge) / (canvas.height - bottomAlphaEdge)
			}

			ctx.beginPath()
			ctx.arc(star.px, star.py, STAR_RADIUS, 0, 2 * Math.PI)

			alpha = alpha * lagModifier
			ctx.fillStyle = `rgba(150,150,150,${alpha})`
			star.alpha = alpha
			ctx.fill()

			let radius = star.connectionRadius
			if (radius) {
				radius = radius * (1 + Math.abs(segment.loudness_max) / 50)
				for (let i2 = nStars - 1; i2 >= 0; i2--) {
					const star2 = stars[i2]
					if (star2.px < star.px + radius && star2.px > star.px - radius && star2.py > star.py - radius && star2.py < star.py + radius) {
						star.connectionOpacity = Math.min(1, (star.connectionOpacity || 0) + 0.0005 * lagModifier)

						const dx = star.px - star2.px
						const dy = star.py - star2.py
						const dt = Math.sqrt(dx * dx + dy * dy)
						const lineAlpha = Math.min(star2.alpha, Math.min(alpha, Math.min(1 - dt / radius, star.connectionOpacity)))

						if (dt < radius + STAR_RADIUS) {
							ctx.beginPath()
							ctx.lineTo(star.px, star.py)
							ctx.strokeStyle = `rgba(${star.color}, ${lineAlpha})`
							ctx.lineTo(star2.px, star2.py)
							ctx.stroke()
							nLines++
						}
					}
				}
			}
		}

		if (showKeyboardShortcuts || drawDebug) {
			ctx.font = "12px monospace"
			ctx.fillStyle = "white"
		}

		if (drawDebug) {
			ctx.fillText(`${canvas.width}x${canvas.height}@${scale} at ~${(60 / lagModifier).toFixed(2)}FPS. ${nStars}/${maximumStarPopulation} stars total, including ${nConnectionStars}/${maxConnectionStars} connectors with ${nLines} active connections, spawning stars with speeds between ${starMinSpeed} - ${starMaxSpeed} (global: ${worldSpeed}). ~ops./frame: ${nStars * (1 + nConnectionStars)}`, 12, 12)
		}

		if (showKeyboardShortcuts) for (let i = 0, y = 48 * 3; i < secretKeyboardShortcutLines.length; i++, y += 12) ctx.fillText(secretKeyboardShortcutLines[i], 12, y)

		lastT = t

		requestAnimationFrame(draw)
	}

	const generateStarSpeed = (max = starMaxSpeed, min = starMinSpeed) => {
		const number = Math.floor(Math.random() * max) + min
		return Math.random() > 0.5 ? number : -number
	}

	const addConnectionStar = ({px, py, vx = generateStarSpeed(), vy = generateStarSpeed()}) => {
		const star = addStar({px, py, vx, vy, connectionRadius: Math.random() * (MAX_CONNECTION_RADIUS - MIN_CONNECTION_RADIUS) + MIN_CONNECTION_RADIUS})
		nConnectionStars++
		star.extraSpeedY = 0
		star.extraSpeedX = 0

		connectionStars.push(star)
	}

	const addFirstConnectionStar = () => addConnectionStar({px: canvas.width / 2, py: canvas.height / 2})

	const spawnTick = (c = 1) => {
		if (nStars >= maximumStarPopulation) return

		if (nConnectionStars === 0) {
			addFirstConnectionStar()
		} else {
			for (let i = nStars - 1; i >= 0; i--) {
				const star = stars[i]
				if (!star) continue

				if (star.connectionRadius) {
					const px = star.px
					const py = star.py

					for (let ic = 0; ic < c; ic++) {
						if (nConnectionStars < maxConnectionStars) {
							if (star.alpha >= 1) addConnectionStar({px, py})
						} else {
							addStar({px, py})
						}
					}
				}
			}
		}
	}

	function hitBeat(beat) {
		if (!nConnectionStars) return // bail if no connection stars
		for (let i = 0; i < nConnectionStars; i++) {
			const star = connectionStars[i]
			const v = BEAT_STRENGTH * beat.confidence
			star.extraSpeedY = star.vy > 0 ? v : -v // * star.vy
			star.extraSpeedX = star.vx > 0 ? v : -v // * star.vx
			// console.log("beat", beat, star, star.extraSpeedY)
			star.extraSpeedResistance = (1 - beat.duration) * BEAT_RESISTANCE
		}
	}

	const spotify = async (url) => {
		const f = await fetch("https://api.spotify.com/v1" + url, {headers: {Authorization: "Bearer " + token}})
		const txt = await f.text()
		if (txt === "") return undefined
		const obj = JSON.parse(txt)
		if (obj.error) {
			if (obj.error.status === 401) {
				window.location = `https://accounts.spotify.com/authorize?client_id=6ed539a873ed442fac572b7f679833a9&redirect_uri=${encodeURIComponent(location.origin)}&scope=user-read-playback-state%20user-read-private%20user-read-email&response_type=token&state=123`
			} else {
				throw obj
			}
		}
		return obj
	}

	const applyTemplate = ($element, data) => {
		if (!$element._template) $element._template = $element.innerHTML

		$element.innerHTML = $element._template
		Object.keys(data).forEach((key) => ($element.innerHTML = $element.innerHTML.split("{" + key + "}").join(data[key])))
	}

	const newTrack = async (track) => {
		const ttt = performance.now()
		console.log("New track!", track)

		applyTemplate($playerMeta, {song: track.item.name, artist: track.item.artists[0].name})

		if (!track.is_playing) {
			console.log("Track not playing, bailing...")
			return
		}

		if (track.item.id) {
			console.log("Getting analysis...")
			const analysis = await spotify("/audio-analysis/" + track.item.id)
			console.log(analysis)

			// Adjust timing, accounting for network latency
			track.progress_ms += performance.now() - ttt

			// remove all of the items that are already used
			const beats = analysis.beats.filter((beat) => track.progress_ms < beat.start * 1000 && beat.confidence > 0.15)
			const tatums = analysis.tatums.filter((tatum) => track.progress_ms < tatum.start * 1000 && tatum.confidence > BEAT_MIN_CONFIDENCE)
			const segments = analysis.segments.filter((segment) => track.progress_ms < segment.start * 1000)
			const sections = analysis.sections.filter((section) => track.progress_ms < section.start * 1000)

			console.log(segments)
			startTime = performance.now()

			const spotifyBeatKeeper = () => {
				const progress_ms = track.progress_ms + (performance.now() - startTime)
				if (beats.length) {
					if (progress_ms >= beats[0].start * 1000) {
						const beat = beats[0]
						beats.splice(0, 1)
						hitBeat(beat)
					}
				}

				if (tatums.length) {
					if (progress_ms >= tatums[0].start * 1000) {
						const tatum = tatums[0]
						tatums.splice(0, 1)
						spawnTick()
					}
				}

				if (segments[0] && progress_ms >= segments[0].start * 1000) {
					console.log()
					segment = segments[0]
					segments.splice(0, 1)
					spawnTick()
				}

				if (sections[0] && progress_ms >= sections[0].start * 1000) {
					section = sections[0]
					sections.splice(0, 1)
				}
				if (!section) debugger

				requestAnimationFrame(spotifyBeatKeeper)
			}

			requestAnimationFrame(spotifyBeatKeeper)
			spotifyBeatKeeper()
		}
	}

	async function trackWatcher() {
		const track = await spotify("/me/player")
		if (!track) return

		const current =
			Math.floor(track.progress_ms / 1000 / 60) +
			":" +
			Math.floor((track.progress_ms / 1000) % 60)
				.toString()
				.padStart(2, "0")
		const end =
			Math.floor(track.item.duration_ms / 1000 / 60) +
			":" +
			Math.floor((track.item.duration_ms / 1000) % 60)
				.toString()
				.padStart(2, "0")
		applyTemplate($playerTime, {current, end})

		if (track.item.id !== currentTrackID) {
			currentTrackID = track.item.id
			await newTrack(track)
		}

		if (track.is_playing) {
			addFirstConnectionStar()
		} else {
			//
		}
	}

	function secretKeyboardShortcuts(e) {
		// You found the secret keyboard shortcuts!
		if (e.key === "F1") showKeyboardShortcuts = !showKeyboardShortcuts

		// Control speed
		if (e.key === "i") worldSpeed = worldSpeed - 0.1
		if (e.key === "o") worldSpeed = worldSpeed + 0.1
		if (e.key === "=") starMaxSpeed += 0.1
		if (e.key === "-") starMaxSpeed -= 0.1
		if (e.key === "]") starMinSpeed += 1
		if (e.key === "[") starMinSpeed -= 1

		// Control connections
		if (e.key === "j") maxConnectionStars--
		if (e.key === "k") maxConnectionStars++
		if (e.key === "z") maximumStarPopulation--
		if (e.key === "x") maximumStarPopulation++

		// Misc.
		if (e.key === "d") drawDebug = !drawDebug
		if (e.key === "h") document.querySelector("main").hidden = !document.querySelector("main").hidden

		// Navigation
		if (e.key === "f") document.fullscreen ? document.exitFullscreen() : document.body.requestFullscreen()
		if (e.key === "r") location.reload()
	}

	window.addEventListener("keydown", secretKeyboardShortcuts)

	// Fix resize

	window.addEventListener("resize", () => {
		const newWidth = window.innerWidth
		if (newWidth !== lastWidth) {
			for (let i = nStars - 1; i >= 0; i--) {
				const star = stars[i]
				const xDiff = newWidth - lastWidth
				star.px += xDiff / 2
			}
			lastWidth = newWidth
			configure()
		}

		const newHeight = window.innerHeight
		if (newHeight !== lastHeight) {
			for (let i = nStars - 1; i >= 0; i--) {
				const star = stars[i]
				const yDiff = newHeight - lastHeight
				star.py += yDiff / 2
			}
			lastHeight = newHeight
			configure()
		}
	})

	// On start...

	if (token) {
		setInterval(trackWatcher, 3000)
		configure()
		trackWatcher().then(() => {
			document.querySelector("#login").hidden = true
		})

		requestAnimationFrame(draw)
	}
})()
