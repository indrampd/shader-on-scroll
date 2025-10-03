import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

export default defineConfig({
	base: "./", // This ensures all assets are referenced relatively
	plugins: [glsl()],
	build: {
		outDir: "dist",
		rollupOptions: {
			input: {
				main: "./js/script-webflow.js",
			},
			output: {
				entryFileNames: "shader-on-scroll.min.js",
				chunkFileNames: "shader-on-scroll.min.js",
				assetFileNames: "shader-on-scroll.[ext]",
				format: "iife",
				name: "ShaderOnScroll",
			},
		},
		minify: "terser",
		sourcemap: false,
	},
});
