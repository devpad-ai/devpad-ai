// @ts-nocheck
// The file compiles yet vscode does not recoginize global acquireVsCodeApi presence

import React, { createContext } from "react";

export const VsCode = createContext(acquireVsCodeApi());

export default function VsCodeProvider({ children }: { children: React.JSX.Element }) {
	return <VsCode.Provider>{children}</VsCode.Provider>;
}
