# spotifystarfield.com
Proof-of-concept music visualizer using Spotify's Analytics API and Canvas.

[![Netlify Status](https://api.netlify.com/api/v1/badges/f279e555-c275-4e08-8503-57e01777522a/deploy-status)](https://app.netlify.com/sites/spotifystarfield/deploys)

## Note about code quality & performance

The rendering code here is particularly poor quality. This is designed as a proof of concept, and not to be taken as an example of how to do something like this.

## Future planned impovements

- Decouple physics and rendering code.
- Improve rendering code, maybe use WebGL?
- Improve physics code, maybe use WASM?
- Fix Spotify login redirecting out of fullscreen
- Port to Svelte
- Remove stuff that shouldn't be in the Starfield class (like UI modifications) 
