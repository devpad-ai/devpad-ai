import React, { useEffect, useState } from "react";
import Home from "./pages/Home";
import NewChat from "./components/NewChat";

export default function App() {
	const [currentPage, setCurrentPage] = useState(<></>);

	useEffect(() => {
		setCurrentPage(<Home setCurrentPage={setCurrentPage} />);
	}, []);

	return (
		<>
			<div className="flex justify-center m-2">
				<NewChat />
			</div>
			{currentPage}
		</>
	);
}
