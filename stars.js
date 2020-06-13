/**
 * super-fun stars simulation
 * written by yours truly, benjamin x
 *
 * @format */
"use strict"
;(function () {
	const canvas = document.getElementById("stars")
	const ctx = canvas.getContext("2d")

	let lastT = 0
	let scale, left, right, bottom, top
	let nStars = 0
	let nConnectionStars = 0
	let nLines = 0
	const stars = []

	const STAR_RADIUS = 1
	const CONNECTION_STAR_PER_PX_SQUARED = 400000
	const MIN_CONNECTION_RADIUS = 100
	const MAX_CONNECTION_RADIUS = 300
	const FADE_OUT_PADDING = 100
	const STAR_SPAWN_INTERVAL = 1000
	const N_IMMEDIATE_SPAWNS = Math.floor((window.innerWidth * window.innerHeight) / 4500)

	// const COLORS = ["255,255,255", "0,255,255", "255,0,0", "100,30,255", "25, 60, 200", "100,0,0"]
	const COLORS = ["255,255,255"]
	let maximumStarPopulation = 1000
	let drawDebug = false
	let starMinSpeed = 1
	let starMaxSpeed = 3
	let worldSpeed = 0.3
	let maxConnectionStars // based on CONNECTION_STAR_PER_PX_SQUARED

	const configure = () => {
		const box = canvas.getBoundingClientRect()
		const width = box.width
		const height = box.height
		scale = window.devicePixelRatio || 1
		canvas.width = Math.floor(width * scale)
		canvas.height = Math.floor(height * scale)

		maxConnectionStars = Math.max(3, Math.floor((canvas.width * canvas.height) / CONNECTION_STAR_PER_PX_SQUARED))

		left = 0
		right = canvas.width
		bottom = canvas.height
		top = 0

		// Normalize coordinate system to use css pixels (see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
		ctx.scale(scale, scale)
	}

	const addStar = ({px, py, vx = generateStarSpeed(), vy = generateStarSpeed(), connectionRadius}) => {
		stars.push({px, py, vx, vy, connectionRadius, color: COLORS.length === 1 ? COLORS[0] : COLORS[Math.floor(Math.random() * COLORS.length)]})
		nStars++
	}

	let showKeyboardShortcuts = false
	const secretKeyboardShortcutLines = secretKeyboardShortcuts.toString().split("\n")
	const draw = (t) => {
		const deltaT = t - lastT
		const lagModifier = deltaT / 16.67

		nLines = 0
		canvas.width = canvas.width
		for (let i = nStars - 1; i >= 0; i--) {
			const star = stars[i]
			star.px += star.vx * worldSpeed * lagModifier
			star.py += star.vy * worldSpeed * lagModifier

			// remove from loop if out of bounds
			if (star.px + STAR_RADIUS > right || star.px - STAR_RADIUS < left || star.py + STAR_RADIUS > bottom || star.py - STAR_RADIUS < top) {
				if (star.connectionRadius) nConnectionStars--
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
			ctx.fillStyle = `rgba(${star.color},${alpha})`
			star.alpha = alpha
			ctx.fill()

			if (star.connectionRadius) {
				for (let i2 = nStars - 1; i2 >= 0; i2--) {
					const star2 = stars[i2]
					if (star2.px < star.px + star.connectionRadius && star2.px > star.px - star.connectionRadius && star2.py > star.py - star.connectionRadius && star2.py < star.py + star.connectionRadius) {
						star.connectionOpacity = Math.min(1, (star.connectionOpacity || 0) + 0.0005 * lagModifier)

						const dx = star.px - star2.px
						const dy = star.py - star2.py
						const dt = Math.sqrt(dx * dx + dy * dy)
						const lineAlpha = Math.min(star2.alpha, Math.min(alpha, Math.min(1 - dt / star.connectionRadius, star.connectionOpacity)))

						if (dt < star.connectionRadius + STAR_RADIUS) {
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

		if (showKeyboardShortcuts) for (let i = 0, y = 12 * 3; i < secretKeyboardShortcutLines.length; i++, y += 12) ctx.fillText(secretKeyboardShortcutLines[i], 12, y)

		lastT = t

		requestAnimationFrame(draw)
	}

	const generateStarSpeed = (max = starMaxSpeed, min = starMinSpeed) => {
		const number = Math.floor(Math.random() * max) + min
		return Math.random() > 0.5 ? number : -number
	}

	const addConnectionStar = ({px, py, vx = generateStarSpeed(), vy = generateStarSpeed()}) => {
		addStar({px, py, vx, vy, connectionRadius: Math.random() * (MAX_CONNECTION_RADIUS - MIN_CONNECTION_RADIUS) + MIN_CONNECTION_RADIUS})
		nConnectionStars++
	}

	const addFirstConnectionStar = () => addConnectionStar({px: canvas.width / 2, py: canvas.height / 2})

	const spawnTick = () => {
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

					if (nConnectionStars < maxConnectionStars) {
						if (star.alpha >= 1) addConnectionStar({px, py})
					} else {
						addStar({px, py})
					}
				}
			}
		}
	}

	const start = () => {
		// add the first connection star
		addFirstConnectionStar()

		// add extra connection stars
		while (nConnectionStars < maxConnectionStars) addConnectionStar({px: Math.floor(canvas.width * Math.random()), py: Math.floor(canvas.height * Math.random())})

		// add more random stars
		for (let i = 0; i < N_IMMEDIATE_SPAWNS; i++) addStar({px: Math.floor(canvas.width * Math.random()), py: Math.floor(canvas.height * Math.random())})
	}

	configure()
	start()
	setInterval(spawnTick, STAR_SPAWN_INTERVAL)
	requestAnimationFrame(draw)

	let lastWidth = window.innerWidth,
		lastHeight = window.innerHeight

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
		if (e.key === "x") maximumStarPopulation = Infinity

		// Misc.
		if (e.key === "d") drawDebug = !drawDebug
		if (e.key === "h") document.querySelector("main").hidden = !document.querySelector("main").hidden
	}

	window.addEventListener("keydown", secretKeyboardShortcuts)

	window.addEventListener("keydown", function keys(e) {
		// Fullscreen
		if (e.key === "f") {
			if (document.fullscreen) {
				document.exitFullscreen()
			} else {
				canvas.requestFullscreen().then(() => {
					stars.splice(1, nStars)
					nStars = 0
					addFirstConnectionStar()
					configure()
				})
			}
		}
	})

	document.querySelector("main").hidden = location.hash === "#background"
})()
