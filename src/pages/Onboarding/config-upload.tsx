import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon,
  XCircleIcon,
} from "@heroicons/react/16/solid";
import yaml from "js-yaml";
import { useRef, useState } from "preact/hooks";
import { APIClient } from "../../pkg/api";
import {
  AlertmanagerConfig,
  AlertmanagerConfigSpec,
  collapseRoutingTree,
} from "../../pkg/types/alertmanager";

enum UploadingStatus {
  NotUploaded,
  Uploading,
  Error,
  Uploaded,
}

const uploadConfig = (config: AlertmanagerConfig) => {
  return new APIClient().uploadConfig(config);
};

export const ConfigUpload = () => {
  const [config, setConfig] = useState<string>("");
  const [parseStatus, setParseStatus] = useState<ConfigStatusProps>({});
  const [uploadingStatus, setUploadingStatus] = useState<UploadingStatus>(
    UploadingStatus.NotUploaded
  );
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
    setUploadingStatus(UploadingStatus.Uploading);
    const parsedConfig = parseConfig(config);
    if (parsedConfig.parseError) {
      setUploadingStatus(UploadingStatus.Error);
      // Fail
      return;
    }

    try {
      const resp = await uploadConfig(parsedConfig.config);
      if (resp.ok) {
        setUploadingStatus(UploadingStatus.Uploaded);
      } else {
        setUploadingStatus(UploadingStatus.Error);
      }
    } catch {
      setUploadingStatus(UploadingStatus.Error);
    }
  };

  let uploadIcon;
  if (uploadingStatus === UploadingStatus.NotUploaded) {
    uploadIcon = <ArrowUpTrayIcon class="inline size-5" />;
  } else if (uploadingStatus === UploadingStatus.Uploading) {
    uploadIcon = <ArrowPathIcon class="animate-spin inline size-5" />;
  } else if (uploadingStatus === UploadingStatus.Uploaded) {
    uploadIcon = <CheckCircleIcon class="size-5 inline" />;
  } else if (uploadingStatus === UploadingStatus.Error) {
    uploadIcon = <XCircleIcon class="size-5 inline" />;
  }

  let uploadButton = <></>;
  if (parseStatus?.config) {
    uploadButton = (
      <button class="p-2 bg-green-600 rounded my-3" onClick={upload}>
        {uploadIcon} Let's go!
      </button>
    );
  }

  return (
    <span class="flex flex-row grow">
      <span class="flex flex-col grow">
        <span class="text-lg my-3">
          <h3>
            Paste your Alertmanager config, or{" "}
            <label for="config-file" class="btn">
              upload one
            </label>
          </h3>
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
  );
};

const parseConfig = (rawConfig: string) => {
  try {
    const parsedConfig = yaml.load(rawConfig);
    const config = AlertmanagerConfigSpec.parse(parsedConfig);
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

const numToHumanString = (
  num: number,
  singleResourceType: string,
  multiResourceType?: string
) => {
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
    return (
      <>
        <XCircleIcon class="size-6 inline" style={{ color: "red" }} />
        Hrmm... That doesn't look like valid YAML...
      </>
    );
  } else if (config) {
    const numReceivers = config.receivers?.length
      ? config.receivers?.length
      : 0;
    const numReceiversStr = numToHumanString(
      numReceivers,
      "receiver",
      "receivers"
    );
    const numTemplatesStr = numToHumanString(
      config.templates?.length,
      "template path"
    );
    const routingTree = collapseRoutingTree(config);
    const numRoutesStr = numToHumanString(
      Object.keys(routingTree.tree).length,
      "unique route"
    );
    const numInhibitionsStr = numToHumanString(
      config.inhibit_rules?.length,
      "inhibition rule"
    );
    const numMuteTimesStr = numToHumanString(
      config.mute_time_intervals?.length,
      "mute time interval"
    );

    let templatesStrIcon = (
      <CheckCircleIcon class="size-6 inline bg-green-600" />
    );
    if (config.templates?.length) {
      templatesStrIcon = (
        <QuestionMarkCircleIcon
          class="size-6 inline"
          style={{ color: "yellow" }}
        />
      );
    }

    return (
      <>
        <ul>
          <li>
            <CheckCircleIcon class="size-6 inline text-green-600" />{" "}
            {numReceiversStr}
          </li>
          <li>
            <CheckCircleIcon class="size-6 inline text-green-600" />{" "}
            {numRoutesStr}
          </li>
          <li>
            {templatesStrIcon} {numTemplatesStr}
          </li>
          <li>
            <CheckCircleIcon class="size-6 inline text-green-600" />{" "}
            {numInhibitionsStr}
          </li>
          <li>
            <CheckCircleIcon class="size-6 inline text-green-600" />{" "}
            {numMuteTimesStr}
          </li>
        </ul>
      </>
    );
  } else {
    return <></>;
  }
};
