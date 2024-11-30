import React, { MouseEventHandler } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

export default function ChatPreview({
	title,
	description,
	onClick
}: {
	title: string;
	description: string;
	onClick: MouseEventHandler<HTMLDivElement>;
}) {
	return (
		<Card className="cursor-pointer transition-all hover:bg-slate-700" onClick={onClick}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<button className="text-code">Open</button>
			</CardContent>
		</Card>
	);
}
