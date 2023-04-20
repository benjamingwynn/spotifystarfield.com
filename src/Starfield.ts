/** @format */

const pkgJSON = require("../package.json")
import XCanvas from "./XCanvas"
import {$} from "./Utility"

interface Star {
	/** X position */
	px: number
	/** Y position */
	py: number
	/** base X velocity */
	vx: number
	/** base Y velocity */
	vy: number
	extraSpeedY: number
	extraSpeedX: number
	extraSpeedResistance: number
	alpha: number
	color: string
}

interface ConnectionStar extends Star {
	connectionRadius: number
	connectionOpacity: number
}

function isConnectionStar(star: Star): star is ConnectionStar {
	return "connectionRadius" in star
}

class StarfieldOptions {
	spawnAlgorithm = 1
	rotationEnabled = 1
	warpOn = 1
	starSpawnLimiter = 10
	STAR_RADIUS = 1
	/** The minimum radius a connection star can reach another star. A random number will be picked between this and `maxConnectionRadius` */
	minConnectionRadius = 30
	maxConnectionRadius = 120
	/** Size around the canvas in pixels where stars will start to fade out. */
	edgeSize = 400
	/** Number of stars per pixels on the screen */
	starPopulationDensity = 0.000045
	/** Whether debug information should be drawn on the screen. */
	drawDebug = false
	drawDebugText = false
	/** The minimum speed a star can be spawned with. */
	starMinSpeed = 1.0
	/** The maximum speed the star can be spawned with. */
	starMaxSpeed = 2
	/** The world speed, should scale all animations evenly. */
	worldSpeed = 0
	/** The rate the world speed changes at */
	worldSpeedSpeed = 0.01
	/** Number of connection stars per pixel on the screen. */
	connectionStarPopulationDensity = 0.00002
	/** Whether keyboard shortcuts should be displayed on the screen. */
	showKeyboardShortcuts = false
	/** How fast star radii change in size when the volume of the track changes. */
	starPulseSpeed = 0.00065

	opacityMultiplier = 0.0005
	lineWidth = 3
}

export default class Starfield extends XCanvas {
	maximumStarPopulation = 0
	// maxConnectionStars = 0
	connectionRadiusProduct = 1
	connectionRadiusProductActual = 1
	nStars = 0
	nConnectionStars = 0
	nLines = 0
	stars: Star[] = []
	connectionStars: ConnectionStar[] = []
	/** Star colors will be drawn from this array randomly. Expects `r,g,b` formatting (`0,0,0` - `255,255,255`). */
	pallette: string[] = []

	actualWorldSpeed: number = 0.0
	warpSpeed = 0.004
	rot = 1
	rotSpeed = 0.0
	spawnRadius = 400
	nStarsInSpawn = 0

	private lightMode = false
	public printErrors: string[] = []
	nConnectionStarsInSpawn: any
	lastSpawnTick: number
	nSpawn0: number = 0
	nSpawn1: number = 0
	nSpawn2: number = 0
	nSpawn3: number = 0
	extraDebugPrint: string = ""

	private maxConnectionStars
	// get maxConnectionStars() {
	// 	const tpx = this.canvas.width * this.canvas.height
	// 	return Math.max(50, Math.floor(tpx * this.options.connectionStarPopulationDensity * this.spawnRadius))
	// }

	layout() {
		super.layout()
		const tpx = this.canvas.width * this.canvas.height
		this.maxConnectionStars = Math.min(140, Math.max(50, Math.floor(tpx * this.options.connectionStarPopulationDensity)))
		this.maximumStarPopulation = Math.min(300, Math.max(75, Math.floor(tpx * this.options.starPopulationDensity)))
	}

	private secretKeyboardShortcuts(e: {key: string}) {
		const opt = this.options

		// Draw the debugging options
		if (e.key === "d") opt.drawDebug = !opt.drawDebug
		if (e.key === "F1") opt.drawDebugText = !opt.drawDebugText

		// Hide the player UI
		if (e.key === "h") {
			$("main").hidden = !$("main").hidden
			localStorage.setItem("hideUI", $("main").hidden ? "1" : "0")
		}

		// Navigation
		if (e.key === "f") {
			if ("webkitRequestFullScreen" in document.documentElement) {
				if (document.fullscreen) {
					// @ts-expect-error experimental fullscreen exit for Safari
					document.documentElement.webkitExitFullscreen()
				} else {
					// @ts-expect-error required for Safari
					document.documentElement.webkitRequestFullScreen()
				}
			} else {
				document.fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen()
			}
		}
		if (e.key === "r") location.reload()

		if (e.key === "l") this.switchTheme(!this.lightMode)
		if (e.key === "s") {
			$("#settings").hidden = !$("#settings").hidden
		}
	}

	private direction: 1 | -1 = 1 as const

	constructor(public options: StarfieldOptions = new StarfieldOptions()) {
		super()

		window.addEventListener("keydown", (e) => {
			this.secretKeyboardShortcuts(e)
		})

		// setInterval(() => {
		// 	this.direction === 1 ? (this.direction = -1) : (this.direction = 1)
		// }, 1000)
		$("main").hidden = localStorage.getItem("hideUI") == "1" && $("#login").hidden
	}

	draw(t: number, deltaT: number, ctx: CanvasRenderingContext2D) {
		const getAlpha = (star: Star) => {
			let alpha = 1

			// find the distance from the closest edge
			if (star.px < this.options.edgeSize) {
				alpha = Math.min(alpha, star.px / this.options.edgeSize)
			}

			if (star.py < this.options.edgeSize) {
				alpha = Math.min(alpha, star.py / this.options.edgeSize)
			}

			const rightAlphaEdge = this.canvas.width - this.options.edgeSize
			if (star.px > rightAlphaEdge) {
				alpha = 1 - (star.px - rightAlphaEdge) / (this.canvas.width - rightAlphaEdge)
			}
			const bottomAlphaEdge = this.canvas.height - this.options.edgeSize
			if (star.py > bottomAlphaEdge) {
				alpha = 1 - (star.py - bottomAlphaEdge) / (this.canvas.height - bottomAlphaEdge)
			}
			return alpha
		}

		// allow max 2 frames of skip
		const lagModifier = Math.min(2, deltaT / 16.67)

		this.nLines = 0
		this.canvas.width = this.canvas.width // this clears the canvas

		if (!this.actualWorldSpeed && this.options.worldSpeed) {
			this.actualWorldSpeed = this.options.worldSpeed
		}
		if (this.options.worldSpeed) {
			if (this.actualWorldSpeed > this.options.worldSpeed) this.actualWorldSpeed -= this.options.worldSpeedSpeed
			if (this.actualWorldSpeed < this.options.worldSpeed) this.actualWorldSpeed += this.options.worldSpeedSpeed
		}

		const worldSpeed = this.actualWorldSpeed || 1

		if (this.connectionRadiusProduct > this.connectionRadiusProductActual) this.connectionRadiusProductActual += this.options.starPulseSpeed * worldSpeed * lagModifier
		if (this.connectionRadiusProduct < this.connectionRadiusProductActual) this.connectionRadiusProductActual -= this.options.starPulseSpeed * worldSpeed * lagModifier

		const cx = this.canvas.width / 2
		const cy = this.canvas.height / 2

		//
		// calculate speeds
		//

		for (let i = this.nStars - 1; i >= 0; i--) {
			const star = this.stars[i]
			star.px += star.vx * worldSpeed * lagModifier
			star.py += star.vy * worldSpeed * lagModifier

			// give things that are further away from the centre a greater velocity
			// (warp speed)
			if (this.options.warpOn) {
				// star.px += (star.px - cx) * this.warpSpeed
				const zx = ((star.px - cx) / (Math.E / 20)) * this.warpSpeed
				const zy = ((star.py - cy) / (Math.E / 20)) * this.warpSpeed

				star.vx += zx
				star.vy += zy
				// star.py += (cy - star.vy) * this.warpSpeed
			}

			if (star.extraSpeedY || star.extraSpeedX) {
				if (star.extraSpeedX > 0) {
					star.extraSpeedX = Math.max(star.extraSpeedX - star.extraSpeedResistance * lagModifier, 0)
					// star.extraSpeedX = Math.max(star.extraSpeedX, 0)
				} else if (star.extraSpeedX < 0) {
					star.extraSpeedX = Math.min(star.extraSpeedX + star.extraSpeedResistance * lagModifier, 0)
				}

				if (star.extraSpeedY > 0) {
					star.extraSpeedY = Math.max(star.extraSpeedY - star.extraSpeedResistance * lagModifier, 0)
				} else if (star.extraSpeedY < 0) {
					star.extraSpeedY = Math.min(star.extraSpeedY + star.extraSpeedResistance * lagModifier, 0)
				}

				star.px += star.extraSpeedX * lagModifier * this.direction
				star.py += star.extraSpeedY * lagModifier * this.direction
			}

			// ensure rounded
			// star.px = Math.round(star.px)
			// star.py = Math.round(star.py)
		}

		//
		// remove stars that are out of bounds
		//

		{
			const STAR_RADIUS = this.options.STAR_RADIUS

			let starsToRemove = []
			let connectionStarsToRemove = []

			for (let i = this.nStars - 1; i >= 0; i--) {
				const star = this.stars[i]

				if (star.px + STAR_RADIUS > this.right || star.px - STAR_RADIUS < this.left || star.py + STAR_RADIUS > this.bottom || star.py - STAR_RADIUS < this.top) {
					if ("connectionRadius" in star) {
						connectionStarsToRemove.push(star)
					}
					starsToRemove.push(star)
				}
			}

			this.nConnectionStars -= connectionStarsToRemove.length
			this.connectionStars = this.connectionStars.filter((star) => !connectionStarsToRemove.includes(star))

			this.nStars -= starsToRemove.length
			this.stars = this.stars.filter((star) => !starsToRemove.includes(star))
		}

		// rotate the canvas (rotation)
		if (this.options.rotationEnabled) {
			this.ctx.save()
			const cx = this.canvas.width / 2
			const cy = this.canvas.height / 2
			ctx.translate(cx, cy)
			this.ctx.rotate((Math.PI / 180) * this.rot)
			this.rot += this.rotSpeed * lagModifier
			if (this.rot > 360) this.rot -= 360 // fix int overflow
			if (this.rot < -360) this.rot += 360 // fix int overflow
			ctx.translate(-cx, -cy)

			if (this.options.drawDebug) {
				this.ctx.strokeStyle = "red"
				this.ctx.beginPath()
				this.ctx.moveTo(this.canvas.width / 2, this.canvas.height / 2)
				this.ctx.lineTo(this.canvas.width / 2, this.canvas.height / 2 - this.spawnRadius)
				this.ctx.stroke()
			}
		}

		if (this.options.drawDebug && this.options.spawnAlgorithm === 1) {
			this.ctx.strokeStyle = "red"
			this.ctx.beginPath()
			this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, this.spawnRadius, 0, Math.PI * 2)
			this.ctx.stroke()
		}

		//
		// draw star positions
		//

		for (let i = this.nStars - 1; i >= 0; i--) {
			const star = this.stars[i]

			this.ctx.beginPath()
			this.ctx.arc(star.px, star.py, this.options.drawDebug ? 16 : this.options.STAR_RADIUS, 0, 2 * Math.PI)

			const alpha = getAlpha(star)
			if (!star.color) {
				switch ((Math.random() * 2) | 0) {
					case 0: {
						star.color = "green"
						break
					}
					case 1: {
						star.color = "red"
						break
					}
				}
			}
			this.ctx.fillStyle = this.options.drawDebug ? (alpha === 1 ? "green" : "red") : this.lightMode ? `rgba(${star.color}, ${0.5})` : `rgba(100,100,100,${alpha})`
			// this.ctx.fillStyle = "black"
			star.alpha = alpha
			this.ctx.fill()

			if (this.options.drawDebug && alpha !== 1) {
				this.ctx.fillStyle = "white"
				this.ctx.fillText("a:" + alpha.toFixed(2), star.px, star.py)
			}
		}

		//
		// draw connecting lines
		//

		for (let i = this.nStars - 1; i >= 0; i--) {
			const star = this.stars[i]

			if (isConnectionStar(star)) {
				if (this.connectionRadiusProduct > this.connectionRadiusProductActual) this.connectionRadiusProductActual += this.options.starPulseSpeed * worldSpeed * lagModifier
				if (this.connectionRadiusProduct < this.connectionRadiusProductActual) this.connectionRadiusProductActual -= this.options.starPulseSpeed * worldSpeed * lagModifier

				const extraRadius = Math.max(Math.abs(cx - star.px), Math.abs(cy - star.py)) / (Math.E * 175)
				let radius = star.connectionRadius * Math.max(1, extraRadius)
				radius = radius * this.connectionRadiusProductActual // * Math.max(1, Math.abs(star.px - cx) * this.warpSpeed * Math.E * 5)

				for (let i2 = this.nStars - 1; i2 >= 0; i2--) {
					const star2 = this.stars[i2]
					if (star2.px < star.px + radius && star2.px > star.px - radius && star2.py > star.py - radius && star2.py < star.py + radius) {
						star.connectionOpacity = Math.min(1, (star.connectionOpacity || 0) + this.options.opacityMultiplier * lagModifier)

						const dx = star.px - star2.px
						const dy = star.py - star2.py
						const dt = Math.sqrt(dx * dx + dy * dy)
						const alpha = getAlpha(star)
						const lineAlpha = Math.min(star2.alpha, Math.min(alpha, Math.min(1 - dt / radius, star.connectionOpacity)))

						if (this.options.drawDebug && !this.options.rotationEnabled) {
							this.ctx.fillStyle = "white"
							this.ctx.fillText(`vx:${star.vx.toFixed(2)} vy:${star.vy.toFixed(2)}`, star.px, star.py)
						}

						if (dt < radius + this.options.STAR_RADIUS) {
							if (this.options.drawDebug) {
								this.ctx.beginPath()
								this.ctx.fillStyle = "yellow"
								this.ctx.arc(star.px, star.py, 8, 0, 2 * Math.PI)
								this.ctx.fill()
								this.ctx.beginPath()
								this.ctx.arc(star.px, star.py, radius + this.options.STAR_RADIUS, 0, 2 * Math.PI)
								this.ctx.strokeStyle = extraRadius > 1 ? "blue" : "cyan"
								this.ctx.lineWidth = 1
								this.ctx.stroke()
							}
							this.ctx.beginPath()
							this.ctx.lineTo(star.px, star.py)
							this.ctx.strokeStyle = this.options.drawDebug ? "yellow" : `rgba(${star.color}, ${lineAlpha})`
							this.ctx.lineTo(star2.px, star2.py)
							this.ctx.stroke()
							this.ctx.lineWidth = this.options.lineWidth

							this.nLines++
						}
					}
				}
			}
		}

		// finish rotation
		{
			this.ctx.restore()
		}

		if (this.options.showKeyboardShortcuts || this.options.drawDebugText || this.options.drawDebug || this.printErrors.length) {
			this.ctx.font = "12px monospace"
			this.ctx.fillStyle = "grey"
		}

		if (this.options.drawDebugText || this.options.drawDebug) {
			const pad = (this.canvas.height - window.innerHeight) / 2
			const lines: string[] = this.options.drawDebugText
				? [
						//
						`spotify starfield ${pkgJSON.version}`,
						`${this.fps.toFixed(2)}FPS. dT:${deltaT.toFixed(2)} lag:${lagModifier.toFixed(2)}`,
						`${this.canvas.width}x${this.canvas.height} (${window.innerWidth}x${window.innerHeight}@${this.scale}). XS: ${this.xs}. ~ops./frame: ${this.nStars * (1 + this.nConnectionStars)}.`,
						`${this.nStars}/${this.maximumStarPopulation} stars total, including ${this.nConnectionStars}/${this.maxConnectionStars} connectors with ${this.nLines} lines,`,
						`Warp: ${this.options.warpOn}. Speed:${this.warpSpeed}`,
						`Rotation: ${this.options.rotationEnabled}. Speed: ${this.rotSpeed} = ${this.rot.toFixed(1)}°`,
						`StarSpeed: ${this.options.starMinSpeed}-${this.options.starMaxSpeed}. WorldSpeed: ${this.actualWorldSpeed}/${this.options.worldSpeed}. StarRadii: ${this.connectionRadiusProductActual.toPrecision(2)}/${this.connectionRadiusProduct.toPrecision(2)} @ ${this.options.starPulseSpeed}.`,
						`SpawnAlgorithm #${this.options.spawnAlgorithm}. Radius: ${this.spawnRadius}. spawnStars: ${this.nStarsInSpawn}. cSpawnStars: ${this.nConnectionStarsInSpawn}/${this.alwaysHaveThisManyConnectionStarsInSpawn}. lastTick: ${this.lastSpawnTick}`,
						`0: ${this.nSpawn0.toString().padStart(2, "0")}. 1: ${this.nSpawn1.toString().padStart(2, "0")}. 2: ${this.nSpawn2.toString().padStart(2, "0")}. 3: ${this.nSpawn3.toString().padStart(2, "0")}.`,
						"",
						...this.extraDebugPrint.split("\n"),
				  ]
				: [`spotify starfield ${pkgJSON.version}. ${this.fps.toFixed(2)}FPS.`, "Press F1 for full debug text."]
			for (let i = 0; i < lines.length; i++) {
				if (!lines[i]) continue
				this.ctx.fillText(`${lines[i]}`, 24, 24 + (pad + (i + 1) * 12))
			}
			//  ROT:${this.rot.toFixed(2)} RdOTSPEED:${this.rotSpeed}
		}

		$(".logger-log").innerText = this.printErrors.join("\n")
	}

	resize(lastWidth: number, lastHeight: number, newWidth: number, newHeight: number) {
		if (newWidth !== lastWidth) {
			for (let i = this.nStars - 1; i >= 0; i--) {
				const star = this.stars[i]
				const xDiff = newWidth - lastWidth
				star.px += xDiff / 2
			}
		}

		if (newHeight !== lastHeight) {
			for (let i = this.nStars - 1; i >= 0; i--) {
				const star = this.stars[i]
				const yDiff = newHeight - lastHeight
				star.py += yDiff / 2
			}
		}
	}

	private generateStarSpeed(max = this.options.starMaxSpeed, min = this.options.starMinSpeed) {
		// const number = Math.floor(Math.random() * max) + min

		// ?
		const number = Math.floor(Math.random() * (max - min + 1) + min)

		// console.log(number)
		return Math.random() > 0.5 ? number : -number
		// const number = (Math.random() - 0.5) * 4
		// if (number > 0 && number < this.options.starMinSpeed) return this.options.starMinSpeed
		// if (number < 0 && number < -this.options.starMinSpeed) return -this.options.starMinSpeed
		// return number
	}

	private generateStarColor(): string {
		return this.pallette[Math.floor(Math.random() * this.pallette.length)]
	}

	public addStar(px = this.canvas.width * Math.random(), py = this.canvas.width * Math.random(), vx = this.generateStarSpeed(), vy = this.generateStarSpeed()) {
		// if (!section) debugger //. don't add a star if not running on a section yet!
		const star: Star = {px, py, vx, vy, color: this.generateStarColor(), extraSpeedY: 0, extraSpeedX: 0, extraSpeedResistance: 0, alpha: 0}
		this.stars.push(star)
		this.nStars++
		return star
	}

	public addConnectionStar(px: number, py: number, vx = this.generateStarSpeed(), vy = this.generateStarSpeed()) {
		// const star = this.addStar(px, py, vx, vy, Math.random() * (this.options.MAX_CONNECTION_RADIUS - this.options.MIN_CONNECTION_RADIUS) + this.options.MIN_CONNECTION_RADIUS)

		const star: ConnectionStar = {
			px,
			py,
			vx,
			vy,
			extraSpeedY: 0,
			extraSpeedX: 0,
			extraSpeedResistance: 0,
			alpha: 0,
			color: this.generateStarColor(),
			connectionRadius: this.options.maxConnectionRadius,
			connectionOpacity: 0,
		}

		this.stars.push(star)
		this.connectionStars.push(star)
		this.nConnectionStars++
		this.nStars++
	}

	public addFirstConnectionStar() {
		this.addConnectionStar(this.canvas.width / 2, this.canvas.height / 2)
	}

	public get xs() {
		return Math.min(this.canvas.height, this.canvas.width)
	}

	private get alwaysHaveThisManyConnectionStarsInSpawn() {
		return Math.floor(this.spawnRadius / (this.connectionRadiusProduct * this.options.starSpawnLimiter))
	}

	public spawnTick() {
		this.lastSpawnTick = performance.now()

		if (this.nStars === 0) {
			this.addFirstConnectionStar()
			return
		}

		this.nStarsInSpawn = 0
		this.nConnectionStarsInSpawn = 0
		this.nSpawn0 = 0
		this.nSpawn1 = 0
		this.nSpawn2 = 0
		this.nSpawn3 = 0

		//
		// count stars and grab the connection stars in spawn
		// do not spawn in this loop!
		//
		if (this.options.spawnAlgorithm == 1) {
			const connectionStarsInSpawn: Star[] = []

			for (let i = this.nStars - 1; i >= 0; i--) {
				const star = this.stars[i] as Star

				// distance from centre
				const dcx = Math.abs(this.canvas.width / 2 - star.px)
				const dcy = Math.abs(this.canvas.height / 2 - star.py)

				const dt = Math.sqrt(dcx * dcx + dcy * dcy)
				if (dt > this.spawnRadius) {
					continue
				}
				this.nStarsInSpawn += 1
				if (isConnectionStar(star) && star.alpha >= 1) {
					this.nConnectionStarsInSpawn++
					connectionStarsInSpawn.push(star)
				}
			}

			//
			// prioritize spawning in spawn area
			//
			for (const star of connectionStarsInSpawn) {
				// stars in spawn
				const px = star.px
				const py = star.py

				// spawn a connection star
				if (this.nConnectionStarsInSpawn < this.alwaysHaveThisManyConnectionStarsInSpawn) {
					this.addConnectionStar(px, py)
					this.nSpawn0++
					this.nConnectionStarsInSpawn++
				} else if (this.nStars < this.maximumStarPopulation) {
					this.addStar(px, py)
					this.nSpawn1++
				}
			}
		}

		//
		// populate left over slots
		//
		for (let i = this.nStars - 1; i >= 0; i--) {
			const star = this.stars[i]
			if (this.nStars < this.maximumStarPopulation) {
				const px = star.px
				const py = star.py
				if (this.nConnectionStars < this.maxConnectionStars && isConnectionStar(star)) {
					this.nSpawn2++
					this.addConnectionStar(px, py)
				} else {
					this.nSpawn3++
					this.addStar(px, py)
				}
			}
		}
	}

	public start() {
		super.start()
		this.switchTheme()

		// *** hook up starfield settings
		{
			const labels = $("#starfield-settings").querySelectorAll("label")
			for (const $label of labels) {
				let block = false
				const prop = $label.dataset.prop
				if (!prop) {
					throw new Error("Expected data-prop attribute to be defined.")
				}
				const $input = $label.querySelector("input")
				const $output = $label.querySelector("code")
				if (!$input || !$output) {
					throw new Error("Expected both <input> and <code> in label.")
				}
				const change = () => {
					this.options[prop] = parseFloat($input.value)
					$output.innerText = this.options[prop]
					this.resize(0, 0, 0, 0)
				}
				if (this.options[prop] === undefined) {
					throw new Error("Expected " + prop + " to be defined on this.options.")
				}
				const reflect = () => {
					$output.innerHTML = this.options[prop]
					$input.value = this.options[prop]
				}
				$label.onmouseenter = () => (block = true)
				$label.onmouseleave = () => (block = false)
				reflect()

				setInterval(() => {
					if (block) {
						console.log("block", $label)
						return
					}
					reflect()
				}, 1000)

				$input.addEventListener("change", change)
			}
		}

		// *** hook up override settings
		{
			const labels = $("#this-settings").querySelectorAll("label")
			for (const $label of labels) {
				let block = false

				const prop = $label.dataset.prop
				if (!prop) {
					throw new Error("Expected data-prop attribute to be defined.")
				}
				const $input = $label.querySelector("input")
				const $output = $label.querySelector("code")
				if (!$input || !$output) {
					throw new Error("Expected both <input> and <code> in label.")
				}
				const change = () => {
					this[prop] = parseFloat($input.value)
					$output.innerText = this[prop]
				}
				const reflect = () => {
					if (block) {
						console.log("block", $label)
						return
					}
					$output.innerText = this[prop]
					$input.value = this[prop]
				}
				setInterval(reflect, 250)
				$label.onmouseenter = () => (block = true)
				$label.onmouseleave = () => (block = false)
				reflect()
				$input.value = this[prop]

				$input.addEventListener("change", change)
			}
		}
	}

	public switchTheme(toLight?: boolean) {
		if (toLight !== undefined) {
			this.lightMode = toLight
		}
		// if light body
		if (this.lightMode) {
			document.body.style.background = "white"
			document.body.classList.add("light")
			this.options.STAR_RADIUS = 3
			this.options.lineWidth = 5
		} else {
			document.body.style.background = ""
			document.body.classList.remove("light")
			this.options.STAR_RADIUS = 1
			this.options.lineWidth = 3
		}
	}
}
