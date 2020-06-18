/** @format */

const path = require("path")

module.exports = {
	entry: "./src/index.ts",
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: "ts-loader",
				exclude: /node_modules/,
			},
		],
	},

	devServer: {
		// contentBase: "./dist",
		port: 5500,
		historyApiFallback: true,
	},

	resolve: {
		extensions: [".ts", ".js"],
	},
	output: {
		path: path.resolve(__dirname),
		filename: "stars.js",
		auxiliaryComment: "© Benjamin Gwynn, " + new Date().getFullYear() + ".",
	},
}
