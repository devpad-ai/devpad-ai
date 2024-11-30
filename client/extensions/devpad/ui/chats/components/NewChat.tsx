import React from "react";
import { Button } from "../../../components/ui/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "../../../components/ui/drawer";

export default function NewChat() {
	return (
		<Drawer>
			<DrawerTrigger>
				<Button variant="outline">New chat</Button>
			</DrawerTrigger>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>Start a new chat</DrawerTitle>
				</DrawerHeader>
				<textarea
					placeholder="Show me how to build the server..."
					className="resize-none bg-slate-800 text-white h-20 rounded m-2 p-1"
				/>
				<DrawerFooter>
					<div className="flex flex-row justify-center">
						<Button>Send</Button>
						<DrawerClose>
							<Button variant="outline">Cancel</Button>
						</DrawerClose>
					</div>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
