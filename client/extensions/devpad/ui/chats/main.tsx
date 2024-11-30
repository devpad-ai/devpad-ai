import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../out.css";
import VsCodeProvider from "./context/VsCodeApi";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
	<React.StrictMode>
		<VsCodeProvider>
			<App />
		</VsCodeProvider>
	</React.StrictMode>
);
