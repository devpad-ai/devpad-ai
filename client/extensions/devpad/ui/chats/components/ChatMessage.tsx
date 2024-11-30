import React from "react";
import { cva } from "class-variance-authority";

const message = cva("text-white rounded w-[60%] min-h-10 mt-4 mb-4 p-2", {
	variants: {
		sender: {
			user: "bg-slate-700 ml-auto",
			ai: "bg-slate-800 mr-auto"
		}
	}
});

export default function ChatMessage({ sender, content }: { sender: "ai" | "user"; content: string }) {
	return <div className={message({ sender })}>{content}</div>;
}
