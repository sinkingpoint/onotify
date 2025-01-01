import {
  ArrowUpOnSquareIcon,
  ArrowUpOnSquareStackIcon,
} from "@heroicons/react/16/solid";
import { useRef } from "preact/hooks";
import { APIClient } from "../../pkg/api";
import { UploadStatus } from "./upload";

interface UploadBoxProps {
  selected?: {
    path: string;
    isDir: boolean;
  };
  uploadCallback?: (path: string, state: UploadStatus) => void;
}

export const UploadBox = ({ selected, uploadCallback }: UploadBoxProps) => {
  let contents = <span class="font-bold">Select a file to upload!</span>;
  if (selected) {
    const { path, isDir } = selected;
    let icon;
    if (isDir) {
      icon = <ArrowUpOnSquareStackIcon class="inline size-72" />;
    } else {
      icon = <ArrowUpOnSquareIcon class="inline size-72" />;
    }

    contents = (
      <>
        {icon}
        <span class="font-bold">{path}</span>
      </>
    );
  }

  const uploadInputRef = useRef<HTMLInputElement>();

  const openFile = async () => {
    if (!uploadInputRef.current) {
      return;
    }

    if (uploadInputRef.current.files.length === 0) {
      return;
    }

    const file = uploadInputRef.current.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = (ev) => {
        let path = selected.path;
        if (path.startsWith("./")) {
          path = path.substring(2);
        }

        if (uploadCallback) {
          uploadCallback(selected.path, UploadStatus.Uploading);
        }

        new APIClient()
          .uploadFile(path, ev.target.result.toString())
          .then((v) => {
            if (uploadCallback) {
              if (v.status === 200) {
                uploadCallback(selected.path, UploadStatus.Uploaded);
              } else {
                uploadCallback(selected.path, UploadStatus.Error);
                // TODO: Toast the error here.
              }
            }
          })
          .catch(() => {
            if (uploadCallback) {
              uploadCallback(selected.path, UploadStatus.Error);
            }
          });
      };

      reader.readAsText(file);
    }
  };

  return (
    <span class="upload-box flex flex-col justify-center items-center">
      <input
        id="upload"
        type="file"
        multiple={selected ? selected.isDir : false}
        style={{ display: "none" }}
        disabled={!selected}
        ref={uploadInputRef}
        onChange={openFile}
      />

      <label for="upload">
        <div class="flex flex-col justify-center items-center">{contents}</div>
      </label>
    </span>
  );
};
