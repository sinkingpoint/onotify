import { LocationProvider, Route, Router, hydrate, prerender as ssr } from "preact-iso";

import { SideBar } from "./components/Sidebar/index.js";
import "./index.css";
import { NotFound } from "./pages/_404.jsx";
import AddSilence from "./pages/AddSilence";
import { Dash } from "./pages/Dash";
import Onboarding from "./pages/Onboarding";
import ViewAlert from "./pages/ViewAlert";
import ViewAlerts from "./pages/ViewAlerts/index.js";
import ViewSilence from "./pages/ViewSilence";
import ViewSilences from "./pages/ViewSilences/index.js";
import { client } from "./pkg/api/client/client.gen.js";

export function App() {
	client.setConfig({
		baseUrl: import.meta.env.MODE === "development" ? "http://localhost:8787" : "https://api.onotifi.com",
		headers: {
			Authorization: "Bearer notify-test",
		},
	});

	return (
		<LocationProvider>
			<SideBar />
			<main>
				<Router>
					<Route path="/" component={Dash} />
					<Route path="/onboarding" component={Onboarding} />
					<Route path="/alerts" component={ViewAlerts} />
					<Route path="/alerts/:fingerprint" component={ViewAlert} />
					<Route path="/silences" component={ViewSilences} />
					<Route path="/silences/new" component={AddSilence} />
					<Route path="/silences/:id" component={ViewSilence} />
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
