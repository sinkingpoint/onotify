import { LocationProvider, Route, Router, hydrate, prerender as ssr } from "preact-iso";

import { Header } from "./components/Header.jsx";
import "./index.css";
import { NotFound } from "./pages/_404.jsx";
import AddSilence from "./pages/AddSilence";
import Onboarding from "./pages/Onboarding";
import ViewAlert from "./pages/ViewAlert";
import ViewSilence from "./pages/ViewSilence";
import { client } from "./pkg/api/client/client.gen.js";

export function App() {
	client.setConfig({
		baseUrl: "http://localhost:8787",
		headers: {
			Authorization: "Bearer notify-test",
		},
	});

	return (
		<LocationProvider>
			<Header />
			<main>
				<Router>
					<Route path="/onboarding" component={Onboarding} />
					<Route path="/alert/:fingerprint" component={ViewAlert} />
					<Route path="/silence/new" component={AddSilence} />
					<Route path="/silence/:id" component={ViewSilence} />
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
