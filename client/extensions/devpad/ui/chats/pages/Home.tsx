import React, { Dispatch, SetStateAction } from "react";
import ChatPreview from "../components/ChatPreview";
import Conversation from "./Conversation";

export default function Home({ setCurrentPage }: { setCurrentPage: Dispatch<SetStateAction<React.JSX.Element>> }) {
	const tempData = [
		{
			title: "Code Snippet Formatting",
			description: "User asks the AI how to properly format a code snippet in VSCode using Prettier."
		},
		{
			title: "Debugging a Function",
			description:
				"User encounters an error when running a JavaScript function and asks the AI for help with debugging in the editor."
		},
		{
			title: "Version Control Help",
			description:
				"User asks how to properly use Git from the editor to commit changes and push them to a remote repository."
		},
		{
			title: "Code Auto-Completion",
			description:
				"User asks how to enable or configure IntelliSense for auto-completion in VSCode while writing Python code."
		},
		{
			title: "Refactoring Code",
			description:
				"User requests advice on how to refactor a large function into smaller, more maintainable functions using VSCode's refactor tools."
		},
		{
			title: "Editor Shortcuts",
			description: "User wants to learn some useful keyboard shortcuts in Visual Studio Code to improve their workflow."
		},
		{
			title: "Extension Recommendation",
			description: "User asks the AI to recommend useful VSCode extensions for JavaScript and TypeScript development."
		},
		{
			title: "Debugging with Breakpoints",
			description:
				"User is debugging a Node.js application in VSCode and asks how to set breakpoints and step through the code."
		},
		{
			title: "Linting Setup",
			description:
				"User wants to set up ESLint in their editor to catch common JavaScript errors and enforce coding standards."
		},
		{
			title: "Workspace Configuration",
			description:
				"User asks how to configure a workspace in VSCode with custom settings for different projects, such as font size and tab spacing."
		}
	];

	return (
		<div className="grid gap-2">
			
			{tempData.map((data) => {
				return (
					<ChatPreview
						title={data.title}
						description={data.description}
						onClick={() => setCurrentPage(<Conversation />)}
					/>
				);
			})}
		</div>
	);
}
