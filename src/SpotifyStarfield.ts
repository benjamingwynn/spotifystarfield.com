/** @format */

import Starfield from "./Starfield"
import {hashFragment, $, applyTemplate} from "./Utility"

class SpotifyStarfieldOptions {
	BEAT_STRENGTH = 15
	BEAT_RESISTANCE = 3
	BEAT_MIN_CONFIDENCE = 0.15
	TATUM_MIN_CONFIDENCE = 0.45
	COLORS = [
		// 0 = C, 1 = C♯/D♭, 2 = D, and so on
		["82,247,146", "170,49,148", "255,51,199"], // picks one of these per new connection star
		["1,126,121", "255,129,255", "1,255,196"], // format = red,green,blue
		["12,212,121", "170,214,126", "255,215,197"],
		["5,252,255", "170,253,124", "255,253,195"],
		["5,20,255", "170,253,124", "5,253,195"],
		["42,251,121", "177,253,123", "215,253,126"],
		["115,250,121", "255,251,123", "117,253,127"],
		["115,252,214", "255,253,215", "119,253,215"],
		["11,253,255", "200,1,255", "119,251,253"],
		["118,214,255", "255,214,255", "120,214,255"],
		["255,0,0", "0,255,0", "0,0,255"],
		["0,0,255", "120,0,255", "215,13,255"],
		["255,133,255", "42,135,255", "255,136,255"],
	]
}

interface SpotifyBeat {
	confidence: number
	duration: number
	start: number
}
interface SpotifySegment {
	start: number
	loudness_max: number
	loudness_max_time: number
	loudness_start: number
	loudness_end: number
}
interface SpotifySection {
	loudness: number
	start: number
	key: number
	tempo: number
}
interface SpotifyTatum {
	confidence: number
	start: number
}
interface SpotifyTrack {
	item: {name: any; artists: {name: any}[]; id: string}
	is_playing: any
	tempo: number
	progress_ms: number
}

interface SpotifyAnalysis {
	beats: SpotifyBeat[]
	segments: SpotifySegment[]
	sections: SpotifySection[]
	tatums: SpotifyTatum[]
	track: SpotifyTrack
}

export default class SpotifyStarfield {
	private starfield = new Starfield()
	private token: string | undefined = hashFragment["access_token"]
	private spotifyOptions = new SpotifyStarfieldOptions()
	private $playerMeta = $("#player-meta")
	private $playerTime = $("#player-time")

	private segment?: SpotifySegment
	private section?: SpotifySection

	private startTime: number = performance.now()
	/** Current track ID. Undefined if not playing */
	private currentTrackID?: string
	private paused: boolean = false

	public get canvas() {
		return this.starfield.canvas
	}

	private isPlaying() {
		return !!this.currentTrackID
	}

	private async spotify(url: string): Promise<any> {
		const f = await fetch("https://api.spotify.com/v1" + url, {headers: {Authorization: "Bearer " + this.token}})
		const txt = await f.text()
		if (txt === "") return undefined
		const obj = JSON.parse(txt)
		if (obj.error) {
			if (obj.error.status === 401) {
				window.location.replace(`https://accounts.spotify.com/authorize?client_id=6ed539a873ed442fac572b7f679833a9&redirect_uri=${encodeURIComponent(location.origin)}&scope=user-read-playback-state%20user-read-private%20user-read-email&response_type=token&state=123`)
			} else {
				throw obj
			}
		}
		return obj
	}

	private async getAnalysis(trackId: string): Promise<SpotifyAnalysis> {
		return <SpotifyAnalysis>await this.spotify("/audio-analysis/" + trackId)
	}

	private pushSpeed = 1

	private hitBeat(beat: SpotifyBeat) {
		if (!this.starfield.nConnectionStars) return // bail if no connection stars
		for (let i = 0; i < this.starfield.nConnectionStars; i++) {
			const star = this.starfield.connectionStars[i]
			const v = this.spotifyOptions.BEAT_STRENGTH * beat.confidence
			star.extraSpeedY = this.pushSpeed * (star.vy > 0 ? v : -v) // * star.vyc
			star.extraSpeedX = this.pushSpeed * (star.vx > 0 ? v : -v) // * star.vx
			// console.log("beat", beat, star, star.extraSpeedY)
			star.extraSpeedResistance = (1 - beat.duration) * this.spotifyOptions.BEAT_RESISTANCE
		}
	}

	private hitTatum(tatum: SpotifyTatum) {
		this.starfield.spawnTick()
	}

	private newSection(section: SpotifySection) {
		this.starfield.options.worldSpeed = section.tempo / 240
		this.starfield.pallette = this.spotifyOptions.COLORS[section.key]
		this.pushSpeed = Math.min(2, Math.max(0.9, Math.abs(-(section.loudness + 10) - 20) / 20))
		console.warn("Changed section", section, this.starfield.connectionRadiusProduct, 20 - section.loudness, this.pushSpeed)
		this.starfield.warpSpeed = 0.005 / (this.pushSpeed * section.tempo) // base this on our already calculated push speed ^
		this.starfield.spawnBoxSize = Math.max(300, this.pushSpeed * 500)
		this.starfield.rotSpeed = Math.sin(section.tempo / (360 * 2))
	}

	private newSegment(segment: SpotifySegment) {
		// Hook the world speed to the track tempo
		this.starfield.connectionRadiusProduct = Math.max(0.3, Math.abs(-(segment.loudness_start + 10) - 30) / 30)
		this.starfield.spawnTick()
	}

	private async newTrack(track: SpotifyTrack) {
		console.log("New track!", track)

		applyTemplate(this.$playerMeta, {song: track.item.name, artist: track.item.artists[0].name})
		await this.resync(track)
	}

	/** Copy of the current song progress. Just used to track if the user has gone backwards or not. */
	private progress_ms = 0

	private async resync(track: SpotifyTrack) {
		const ttt = performance.now()
		if (track.item.id) {
			console.log("Getting analysis...")
			const analysis = await this.getAnalysis(track.item.id)
			console.log(analysis)

			// Adjust timing, accounting for network latency
			track.progress_ms += performance.now() - ttt

			// remove all of the items that are already used
			const beats = analysis.beats.filter((beat) => beat.confidence > this.spotifyOptions.BEAT_MIN_CONFIDENCE)
			const tatums = analysis.tatums.filter((tatum) => tatum.confidence > this.spotifyOptions.TATUM_MIN_CONFIDENCE)
			const segments = analysis.segments
			const sections = analysis.sections

			// Init
			this.startTime = performance.now()

			let beatIndex = beats.findIndex((b) => b.start * 1000 >= track.progress_ms)
			if (beatIndex === -1) beatIndex = 0

			let tatumIndex = tatums.findIndex((t) => t.start * 1000 >= track.progress_ms)
			if (tatumIndex === -1) tatumIndex = 0

			this.segment = undefined
			this.section = undefined

			console.log("All sections:", sections)

			let loopID = Math.floor(Math.random() * 1024 * 1024).toString(16)
			/** This fires every frame. It keeps `segment` and `section` in sync, and fires the `hitTatum` and `hitBeat` calls at the right time. */
			console.log("Started spotifyBeatKeeper loop #" + loopID)
			const spotifyBeatKeeper = () => {
				if (track.item.id !== this.currentTrackID) {
					console.log("Left spotifyBeatKeeper loop #" + loopID)
					return // escape this if changed
				}

				if (!this.paused) {
					const progress_ms = track.progress_ms + (performance.now() - this.startTime)

					if (beatIndex < beats.length && progress_ms >= beats[beatIndex].start * 1000) {
						this.hitBeat(beats[beatIndex])
						beatIndex++
					}

					if (tatumIndex < tatums.length && progress_ms >= tatums[tatumIndex].start * 1000) {
						this.hitTatum(tatums[tatumIndex])
						tatumIndex++
					}

					let changedSegment = false
					for (let i = 0; i < segments.length; i++) {
						const s = segments[i]
						if (progress_ms >= s.start * 1000) {
							if (!this.segment) {
								this.segment = s
								changedSegment = true
							} else if (this.segment && s.start > this.segment.start) {
								this.segment = s
								changedSegment = true
							}
						}
					}
					if (changedSegment && this.segment) this.newSegment(this.segment)

					let changedSection = false
					for (let i = 0; i < sections.length; i++) {
						const s = sections[i]
						if (progress_ms >= s.start * 1000) {
							if (!this.section) {
								this.section = s
								changedSection = true
							} else if (this.section && s.start > this.section.start) {
								this.section = s
								changedSection = true
							}
						}
					}
					if (changedSection && this.section) this.newSection(this.section)
				}

				requestAnimationFrame(spotifyBeatKeeper)
			}

			spotifyBeatKeeper()
			// this.newSection(this.section)
		}
	}

	private async trackWatcher() {
		try {
			const track = await this.spotify("/me/player")
			if (!track) return

			// update the UI
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
			applyTemplate(this.$playerTime, {current, end})

			if (track.item.id !== this.currentTrackID) {
				this.currentTrackID = track.item.id
				await this.newTrack(track)
			} else if (track.progress_ms < this.progress_ms) {
				console.log("Went backwards in song, for all intents and purposes this is treated like a new song.")
				await this.resync(track)
			}

			if (track.is_playing) {
				this.starfield.addFirstConnectionStar()
				this.paused = false
			} else {
				this.paused = true
			}

			this.progress_ms = track.progress_ms
		} catch (ex) {
			this.starfield.printErrors.push("Error getting current track.")
			console.error(ex)
		}
	}

	public start() {
		// On start...
		this.starfield.start()

		console.log("Started spotify visualizer with token:" + this.token)
		if (this.token) {
			setInterval(() => this.trackWatcher(), 3000)
			this.trackWatcher().then(() => {
				$("#login").hidden = true
			})
		}
	}
}
