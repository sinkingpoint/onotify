import { CheckCircleIcon, QuestionMarkCircleIcon, XCircleIcon } from "@heroicons/react/16/solid";
import yaml from "js-yaml";
import { useRef, useState } from "preact/hooks";
import { postConfig } from "../../pkg/api/client";
import { AlertmanagerConfig, AlertmanagerConfigSpec, collapseRoutingTree } from "../../pkg/types/alertmanager";
import { getUploadIcon, UploadStatus } from "./upload";

interface ConfigUploadProps {
	uploadSucessCallback?: () => void;
}

export const ConfigUpload = ({ uploadSucessCallback: uploadSuccessCallback }: ConfigUploadProps) => {
	const [config, setConfig] = useState<string>("");
	const [parseStatus, setParseStatus] = useState<ConfigStatusProps>({});
	const [uploadingStatus, setUploadingStatus] = useState<UploadStatus>(UploadStatus.NotUploaded);
	const uploadInputRef = useRef<HTMLInputElement>();
	const configTextBoxRef = useRef<HTMLTextAreaElement>();
	const openFile = async () => {
		if (uploadInputRef.current.files.length === 0) {
			return;
		}

		const file = uploadInputRef.current.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onloadend = (ev) => {
				setConfig(ev.target.result.toString());
				setParseStatus(parseConfig(ev.target.result.toString()));
			};

			reader.readAsText(file);
		}
	};

	const handleConfigChange = () => {
		setConfig(configTextBoxRef.current.value);
		setParseStatus(parseConfig(configTextBoxRef.current.value));
	};

	const upload = async () => {
		setUploadingStatus(UploadStatus.Uploading);
		const parsedConfig = parseConfig(config);
		if (parsedConfig.parseError) {
			setUploadingStatus(UploadStatus.Error);
			// Fail
			return;
		}

		try {
			const loadedConfig = yaml.load(config) as any;
			const { error } = await postConfig({ body: loadedConfig });
			if (!error) {
				setUploadingStatus(UploadStatus.Uploaded);
				uploadSuccessCallback();
			} else {
				setUploadingStatus(UploadStatus.Error);
			}
		} catch {
			setUploadingStatus(UploadStatus.Error);
		}
	};

	let uploadIcon = getUploadIcon(uploadingStatus);

	let uploadButton = <></>;
	if (parseStatus?.config) {
		uploadButton = (
			<button class="p-2 bg-green-600 rounded my-3" onClick={upload}>
				{uploadIcon} Let's go!
			</button>
		);
	}

	return (
		<>
			<h1 class="text-3xl font-bold my-3">Get started sending your alerts</h1>
			<span class="flex flex-row grow">
				<span class="flex flex-col grow">
					<span class="text-lg my-3">
						<h2>
							Paste your Alertmanager config, or{" "}
							<label for="config-file" class="btn">
								upload one
							</label>
						</h2>
					</span>
					<span class="flex flex-row grow">
						<span class="flex flex-row basis-2/3 grow">
							<input
								id="config-file"
								type="file"
								accept=".yml,.yaml"
								ref={uploadInputRef}
								onChange={openFile}
								style="display: none;"
							/>
							<textarea
								value={config}
								class="config-input grow mb-5 mr-5 p-3"
								ref={configTextBoxRef}
								onInput={handleConfigChange}
							/>
						</span>

						<span class="basis-1/3">
							<ConfigStatus {...parseStatus} />
							{uploadButton}
						</span>
					</span>
				</span>
			</span>
		</>
	);
};

const parseConfig = (rawConfig: string) => {
	try {
		const parsedConfig = yaml.load(rawConfig);
		const config = AlertmanagerConfigSpec.parse(parsedConfig);
		console.log("sucessfully parsed: ", config);
		return {
			config,
		};
	} catch (e) {
		return {
			parseError: "" + e,
		};
	}
};

interface ConfigStatusProps {
	parseError?: string;
	config?: AlertmanagerConfig;
}

const numToHumanString = (num: number, singleResourceType: string, multiResourceType?: string) => {
	if (!multiResourceType) {
		multiResourceType = `${singleResourceType}s`;
	}

	if (!num) {
		return `No ${multiResourceType}`;
	} else if (num === 1) {
		return `1 ${singleResourceType}`;
	} else {
		return `${num} ${multiResourceType}`;
	}
};

const ConfigStatus = ({ parseError, config }: ConfigStatusProps) => {
	if (parseError) {
		console.log(parseError);
		return (
			<>
				<XCircleIcon class="size-6 inline" style={{ color: "red" }} />
				Hrmm... That doesn't look like valid YAML...
			</>
		);
	} else if (config) {
		const numReceivers = config.receivers?.length ? config.receivers?.length : 0;
		const numReceiversStr = numToHumanString(numReceivers, "receiver", "receivers");
		const numTemplatesStr = numToHumanString(config.templates?.length, "template path");
		const routingTree = collapseRoutingTree(config);
		const numRoutesStr = numToHumanString(Object.keys(routingTree.tree).length, "unique route");
		const numInhibitionsStr = numToHumanString(config.inhibit_rules?.length, "inhibition rule");
		const numMuteTimesStr = numToHumanString(config.mute_time_intervals?.length, "mute time interval");

		let templatesStrIcon = <CheckCircleIcon class="size-5 inline" />;
		if (config.templates?.length) {
			templatesStrIcon = <QuestionMarkCircleIcon class="size-5 inline" />;
		}

		return (
			<>
				<ul>
					<li>
						<CheckCircleIcon class="size-5 inline" /> {numReceiversStr}
					</li>
					<li>
						<CheckCircleIcon class="size-5 inline" /> {numRoutesStr}
					</li>
					<li>
						{templatesStrIcon} {numTemplatesStr}
					</li>
					<li>
						<CheckCircleIcon class="size-5 inline" /> {numInhibitionsStr}
					</li>
					<li>
						<CheckCircleIcon class="size-5 inline" /> {numMuteTimesStr}
					</li>
				</ul>
			</>
		);
	} else {
		return <></>;
	}
};
