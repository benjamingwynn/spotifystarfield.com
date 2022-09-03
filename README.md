# spotifystarfield.com
Proof-of-concept music visualizer using Spotify's Analytics API and Canvas.

## Note about code quality & performance

The rendering code here is particularly poor quality. This is designed as a proof of concept, and not to be taken as an example of how to do something like this.

## Future planned impovements

- Decouple physics and rendering code.
- Improve rendering code, maybe use WebGL?
- Improve physics code, maybe use WASM?
- Fix Spotify login redirecting out of fullscreen
- Port to Svelte
- Remove stuff that shouldn't be in the Starfield class (like UI modifications) 
