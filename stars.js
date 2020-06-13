/**
 * super-fun stars simulation
 * written by yours truly, benjamin x
 *
 * @format */
"use strict"
;(function () {
	const canvas = document.getElementById("stars")
	const ctx = canvas.getContext("2d")

	const STAR_RADIUS = 2
	let MAX_CONNECTION_STARS = 7
	const MIN_CONNECTION_RADIUS = 300
	const MAX_CONNECTION_RADIUS = 900
	const FADE_OUT_PADDING = 100
	let SPEED = 0.05
	const STAR_SPAWN_INTERVAL = 1000
	const N_IMMEDIATE_SPAWNS = 100
	const COLORS = ["255,255,255", "0,255,255", "255,0,0", "100,30,255", "25, 60, 200", "100,0,0"]

	const stars = []
	window.stars = stars
	let nStars = 0
	let nConnectionStars = 0
	let nLines = 0
	let drawDebug = true

	let scale, left, right, bottom, top

	const configure = () => {
		const box = canvas.getBoundingClientRect()
		const width = box.width
		const height = box.height
		scale = window.devicePixelRatio || 1
		canvas.width = Math.floor(width * scale)
		canvas.height = Math.floor(height * scale)

		left = 0
		right = canvas.width
		bottom = canvas.height
		top = 0

		// Normalize coordinate system to use css pixels (see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
		ctx.scale(scale, scale)
	}

	const addStar = ({px, py, vx = randomUpOrDown(10, 1), vy = randomUpOrDown(10, 1), connectionRadius}) => {
		stars.push({px, py, vx, vy, connectionRadius, color: COLORS.length === 1 ? COLORS[0] : COLORS[Math.floor(Math.random() * COLORS.length)]})
		nStars++
	}

	const draw = () => {
		nLines = 0
		canvas.width = canvas.width
		for (let i = nStars - 1; i >= 0; i--) {
			const star = stars[i]
			star.px += star.vx * SPEED
			star.py += star.vy * SPEED

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

			// ctx.fillStyle = `rgba(255,255,255,${alpha})`
			ctx.fillStyle = `rgba(${star.color},${alpha})`
			star.alpha = alpha
			ctx.fill()

			if (star.connectionRadius) {
				for (let i2 = nStars - 1; i2 >= 0; i2--) {
					const star2 = stars[i2]
					if (star2.px < star.px + star.connectionRadius && star2.px > star.px - star.connectionRadius && star2.py > star.py - star.connectionRadius && star2.py < star.py + star.connectionRadius) {
						star.connectionOpacity = Math.min(1, (star.connectionOpacity || 0) + 0.0005)
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

		if (drawDebug) {
			ctx.fillStyle = "white"
			ctx.fillText(`${canvas.width}x${canvas.height}x${scale} SPEED=${SPEED}. ${nStars} stars total, including ${nConnectionStars} connection stars (max ${MAX_CONNECTION_STARS}) with ${nLines} active connections. Approx. ops/frame: ${nStars * (1 + nConnectionStars)}`, 12, 12)
		}

		requestAnimationFrame(draw)
	}

	const randomUpOrDown = (max, min) => {
		const number = Math.floor(Math.random() * max) + min
		return Math.random() > 0.5 ? number : -number
	}

	const addConnectionStar = ({px, py, vx = randomUpOrDown(10, 1), vy = randomUpOrDown(10, 1)}) => {
		addStar({px, py, vx, vy, connectionRadius: Math.random() * (MAX_CONNECTION_RADIUS - MIN_CONNECTION_RADIUS) + MIN_CONNECTION_RADIUS})
		nConnectionStars++
	}

	const addFirstConnectionStar = () => addConnectionStar({px: canvas.width / 2, py: canvas.height / 2, vx: 0, vy: -1})

	const spawnTick = () => {
		if (nConnectionStars === 0) {
			addFirstConnectionStar()
		} else {
			for (let i = nStars - 1; i >= 0; i--) {
				const star = stars[i]
				if (!star) continue

				if (star.connectionRadius) {
					const px = star.px
					const py = star.py

					if (nConnectionStars < MAX_CONNECTION_STARS) {
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
		while (nConnectionStars < MAX_CONNECTION_STARS) addConnectionStar({px: Math.floor(canvas.width * Math.random()), py: Math.floor(canvas.height * Math.random())})

		// add more random stars
		for (let i = 0; i < N_IMMEDIATE_SPAWNS; i++) addStar({px: Math.floor(canvas.width * Math.random()), py: Math.floor(canvas.height * Math.random())})
	}

	configure()
	start()
	setInterval(spawnTick, STAR_SPAWN_INTERVAL)
	requestAnimationFrame(draw)
	window.addEventListener("resize", configure)

	window.addEventListener("keypress", (e) => {
		if (e.key === "i") SPEED = SPEED - 0.02
		if (e.key === "o") SPEED = SPEED + 0.02
		if (e.key === "j") MAX_CONNECTION_STARS--
		if (e.key === "k") MAX_CONNECTION_STARS++
		if (e.key === "d") drawDebug = !drawDebug
		if (e.key === "h") document.querySelector("main").hidden = !document.querySelector("main").hidden
	})

	document.querySelector("main").hidden = location.hash === "#background"
})()
