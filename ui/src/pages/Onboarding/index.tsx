import { useEffect, useState } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import { getConfig, getRequiredFiles } from "../../pkg/api/client";
import { ConfigUpload } from "./config-upload";
import { ExtraFilesUpload } from "./extra-files-upload";
import "./style.css";

enum OnboardingState {
	Unknown,
	ConfigUpload,
	ExtraFilesUpload,
	Done,
}

const getOnboardingState = async () => {
	const { error: configErr } = await getConfig();
	if (configErr) {
		return OnboardingState.ConfigUpload;
	}

	const { data: requiredFiles } = await getRequiredFiles();

	if (requiredFiles.secrets.some((s) => !s.uploaded) || requiredFiles.templates.some((t) => !t.uploaded)) {
		return OnboardingState.ExtraFilesUpload;
	}

	return OnboardingState.Done;
};

export default () => {
	const [onboardingState, setOnboardingState] = useState(OnboardingState.Unknown);

	const [refresh, setRefresh] = useState(false);

	useEffect(() => {
		const refreshOnboardingState = async () => {
			setOnboardingState(await getOnboardingState());
		};

		refreshOnboardingState();
	}, [refresh]);

	let screen: JSX.Element;
	if (onboardingState === OnboardingState.ConfigUpload) {
		screen = <ConfigUpload uploadSucessCallback={() => setRefresh(!refresh)} />;
	} else if (onboardingState === OnboardingState.ExtraFilesUpload) {
		screen = <ExtraFilesUpload />;
	} else if (onboardingState === OnboardingState.Done) {
		// Redirect to app.
		window.location.replace("/");
	}

	return <div class="home">{screen}</div>;
};
