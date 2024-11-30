import { defineConfig } from "rollup";
import multiInput from "rollup-plugin-multi-input";
import typescript from "rollup-plugin-typescript2";
import ignoreImport from "rollup-plugin-ignore-import";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import nodePolyfill from "rollup-plugin-polyfill-node";

export default defineConfig([
	{
		input: ["ui/**/main.tsx"],
		output: { dir: "temp" },
		external: ["*.css"],
		plugins: [
			commonjs(),
			nodePolyfill(),
			multiInput(),
			typescript({ resolveJsonModule: true, tsconfig: "./tsconfig.react.json" }),
			resolve({
				browser: true,
				jsnext: true
			}),
			ignoreImport({
				extensions: [".css"]
			})
		]
	}
]);
