import { LocationProvider, Route, Router, hydrate, prerender as ssr } from "preact-iso";

import { Header } from "./components/Header.jsx";
import "./index.css";
import { NotFound } from "./pages/_404.jsx";
import { NewSilence } from "./pages/AddSilence";
import { AlertPage } from "./pages/Alert/index.js";
import { Onboarding } from "./pages/Onboarding/index.js";

export function App() {
	return (
		<LocationProvider>
			<Header />
			<main>
				<Router>
					<Route path="/onboarding" component={Onboarding} />
					<Route path="/alert/:fingerprint" component={AlertPage} />
					<Route path="/silence/new" component={NewSilence} />
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
