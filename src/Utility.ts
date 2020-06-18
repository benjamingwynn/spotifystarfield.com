/**
 * Utility functions.
 * @format
 */

/**  Quickly find an element using jQuery-like notation. */
const $: (q: string) => HTMLElement = (q: string) =>
	document.querySelector(q) ||
	(function () {
		throw new Error("Could not find element " + q)
	})()

/** An object of the current hash fragment. */
const hashFragment: {[param: string]: string} = location.hash
	.substr(1)
	.split("&")
	.reduce((hash: any, str) => {
		const s = str.split("=")
		if (s.length === 2) {
			hash[s[0]] = s[1]
		}
		return hash
	}, {})

console.log(hashFragment)

/** Random number generator. */
const random = (a: number, b?: number) => (b ? Math.random() * (b - a) + a : Math.random() * a)

const applyTemplate = ($element: HTMLElement, data: any) => {
	// TODO: Rewrite this entire thing
	// @ts-ignore
	if (!$element._template) $element._template = $element.innerHTML
	// @ts-ignore
	$element.innerHTML = $element._template
	Object.keys(data).forEach((key) => ($element.innerHTML = $element.innerHTML.split("{" + key + "}").join(data[key])))
}

export {random, applyTemplate, hashFragment, $}
