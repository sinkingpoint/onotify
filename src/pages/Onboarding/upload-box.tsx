import { ArrowUpOnSquareIcon, ArrowUpOnSquareStackIcon } from "@heroicons/react/16/solid";
import { useRef } from "preact/hooks";
import { APIClient } from "../../pkg/api";
import { UploadStatus } from "./upload";

interface UploadBoxProps {
	selected?: {
		path: string;
		isDir: boolean;
	};
	uploadCallback?: (path: string, state: UploadStatus) => void;
	validateFile?: (path: string) => boolean;
}

export const UploadBox = ({ selected, uploadCallback, validateFile }: UploadBoxProps) => {
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

	const uploadFile = (localFile: Blob, resolvedPath: string) => {
		const reader = new FileReader();
		reader.onloadend = (ev) => {
			let path = resolvedPath;
			if (path.startsWith("./")) {
				path = path.substring(2);
			}

			if (uploadCallback) {
				uploadCallback(resolvedPath, UploadStatus.Uploading);
			}

			new APIClient()
				.uploadFile(path, ev.target.result.toString())
				.then((v) => {
					if (uploadCallback) {
						if (v.status === 200) {
							uploadCallback(resolvedPath, UploadStatus.Uploaded);
						} else {
							uploadCallback(resolvedPath, UploadStatus.Error);
							// TODO: Toast the error here.
						}
					}
				})
				.catch(() => {
					if (uploadCallback) {
						uploadCallback(resolvedPath, UploadStatus.Error);
					}
				});
		};

		reader.readAsText(localFile);
	};

	const openFile = async () => {
		if (!uploadInputRef.current) {
			return;
		}

		if (uploadInputRef.current.files.length === 0) {
			return;
		}

		if (!selected.isDir) {
			// We only have one file to upload
			const file = uploadInputRef.current.files[0];
			if (file) {
				uploadFile(file, selected.path);
			}
		} else {
			for (const file of uploadInputRef.current.files) {
				const resolvedPath = `${selected.path}/${file.name}`;
				if (validateFile && !validateFile(resolvedPath)) {
					// Skip this file if it's not one we need.
					continue;
				}
				uploadFile(file, resolvedPath);
			}
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

			<label
				for="upload"
				class="flex flex-grow flex-col justify-center items-center"
				style={{ width: "100%", height: "100%" }}
			>
				{contents}
			</label>
		</span>
	);
};
