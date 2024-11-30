// @ts-check

const fs = require("fs");
const { resolve } = require("path");

const uiPackages = fs.readdirSync(resolve(__dirname, "../temp/ui"));

if (!uiPackages) {
	throw new Error("No built packages found");
}

let head = "";

if (fs.existsSync(resolve(__dirname, "../ui/out.css"))) {
	const css = fs.readFileSync(resolve(__dirname, "../ui/out.css"));
	head += `<style>${css}</style>`;
}

uiPackages.forEach((uiPackage) => {
	const assets = fs.readdirSync(resolve(__dirname, `../temp/ui/${uiPackage}`));

	if (!assets) {
		throw new Error("No assets in UI package");
	}

	let body = "";

	for (const asset of assets) {
		if (/^.*\.(js)$/.test(asset)) {
			const js = fs.readFileSync(resolve(__dirname, `../temp/ui/${uiPackage}/${asset}`)).toString();
			body += `<script>${js}</script> \n`;
		} else {
			console.warn("Unsupported asset shipped in ui bundle. Skiped.");
		}
	}

	const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${uiPackage.toUpperCase()}</title>
        ${head}
    </head>
    <body>
        <div id="root"></div>
        ${body}
    </body>
    </html>
`;

	if (!fs.existsSync(resolve(__dirname, `../out/ui/`))) {
		fs.mkdirSync(resolve(__dirname, `../out/ui/`));
	}

	fs.writeFileSync(resolve(__dirname, `../out/ui/${uiPackage}.html`), html);
});
