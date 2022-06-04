/**
 *  Class to handle drawing of things to the canvas.
 *
 * @format
 */

export default abstract class XCanvas {
	public canvas = document.createElement("canvas")
	protected ctx: CanvasRenderingContext2D

	protected left: number = 0
	protected right: number = 0
	protected bottom: number = 0
	protected top: number = 0
	protected scale: number = 0

	private lastT = 0
	private lastWidth = window.innerWidth
	private lastHeight = window.innerHeight
	private lastFPSRead = performance.now()
	protected fps = 0

	abstract resize(lastWidth: number, lastHeight: number, newWidth: number, newHeight: number): void

	private drawHook: FrameRequestCallback = (t: number) => {
		const deltaT = t - this.lastT
		if (t > this.lastFPSRead + 500) {
			this.fps = (16.67 / deltaT) * 60
			this.lastFPSRead = t
		}
		this.draw(t, deltaT, this.ctx)
		this.lastT = t
		requestAnimationFrame(this.drawHook)
	}

	constructor() {
		const ctx = this.canvas.getContext("2d")
		if (!ctx) throw new Error("Could not get 2D rendering context.")
		this.ctx = ctx

		setInterval(() => {
			const newHeight = window.innerHeight
			const newWidth = window.innerWidth
			if (newHeight !== this.lastHeight || newWidth !== this.lastWidth) {
				const oldHeight = this.canvas.height
				const oldWidth = this.canvas.width
				this.layout()
				this.resize(oldWidth, oldHeight, this.canvas.width, this.canvas.height)
				this.lastWidth = newWidth
				this.lastHeight = newHeight
			}
		}, 250)
	}

	public start() {
		this.layout()
		requestAnimationFrame(this.drawHook)
	}

	protected layout() {
		const box = this.canvas.getBoundingClientRect()

		// rotation requires equal width and height
		const width = Math.max(box.width, box.height)
		const height = Math.max(box.width, box.height)

		// const width = box.width
		// const height = box.height

		this.scale = window.devicePixelRatio || 1
		this.canvas.width = Math.floor(width)
		this.canvas.height = Math.floor(height)

		// this.left = 0
		this.right = this.canvas.width
		this.bottom = this.canvas.height
		// this.top = 0

		// Normalize coordinate system to use css pixels (see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
		this.ctx.scale(this.scale, this.scale)
	}

	abstract draw(t: number, deltaT: number, ctx: CanvasRenderingContext2D): void
}
