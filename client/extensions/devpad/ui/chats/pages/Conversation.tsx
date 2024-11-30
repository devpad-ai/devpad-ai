import React from "react";
import ChatMessage from "../components/ChatMessage";

export default function Conversation() {
	return (
		<div>
			<ChatMessage sender="user" content="Hello, world" />
			<ChatMessage sender="ai" content="Hi, world" />
			<textarea
				placeholder="Show me how to build the server..."
				className="resize-none bg-slate-800 text-white h-20 rounded m-2 p-1 w-[100%] mt-auto"
			/>
		</div>
	);
}
