/** @format */
import {$} from "./Utility"
import SpotifyStarfield from "./SpotifyStarfield"

// Create, append and start the spotify starfield
const c = new SpotifyStarfield()
document.body.appendChild(c.canvas)
c.start()

// Fix the attribute to match the current location.
$("a").setAttribute("href", `https://accounts.spotify.com/authorize?client_id=6ed539a873ed442fac572b7f679833a9&redirect_uri=${encodeURIComponent(location.origin)}&scope=user-read-playback-state%20user-read-private%20user-read-email&response_type=token&state=123`)
