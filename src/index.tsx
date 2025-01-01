import { LocationProvider, Route, Router, hydrate, prerender as ssr } from "preact-iso";

import { Header } from "./components/Header.jsx";
import "./index.css";
import { Onboarding } from "./pages/Onboarding/index.js";
import { NotFound } from "./pages/_404.jsx";

export function App() {
	return (
		<LocationProvider>
			<Header />
			<main>
				<Router>
					<Route path="/onboarding" component={Onboarding} />
					<Route default component={NotFound} />
				</Router>
			</main>
		</LocationProvider>
	);
}

if (typeof window !== "undefined") {
	hydrate(<App />, document.getElementById("app"));
}

export async function prerender(data) {
	return await ssr(<App {...data} />);
}
