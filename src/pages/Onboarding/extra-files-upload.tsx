import { MouseEventHandler } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { APIClient } from "../../pkg/api";
import { buildTrie, NeededFile, trieNode } from "./trie";
import { getUploadIcon, UploadStatus } from "./upload";
import { UploadBox } from "./upload-box";

const trieToList = (parentPath: string, roots: trieNode[], onClick: MouseEventHandler<HTMLLIElement>) => {
	return roots.map((r) => {
		let filePath = r.path;
		if (parentPath) {
			filePath = `${parentPath}/${filePath}`;
		}

		if (r.children.length === 0) {
			return (
				<li data-file-path={filePath} data-is-dir={r.isDir} onClick={onClick}>
					<span>
						{getUploadIcon(r.uploaded)}
						{r.path}
					</span>
				</li>
			);
		} else {
			return (
				<li data-file-path={filePath} data-is-dir={r.isDir} onClick={onClick}>
					<span>
						{getUploadIcon(r.uploaded)}
						{r.path}
					</span>
					<ul>{trieToList(filePath, r.children, onClick)}</ul>
				</li>
			);
		}
	});
};

export const ExtraFilesUpload = () => {
	const [secrets, setSecrets] = useState<NeededFile[]>([]);
	const [templates, setTemplates] = useState<NeededFile[]>([]);
	const [selected, setSelected] = useState<HTMLLIElement>();

	useEffect(() => {
		const fetchNeeded = async () => {
			const { secrets, templates } = await (await new APIClient().getRequiredConfigFiles()).json();
			setSecrets(
				secrets.map((s) => {
					if (!s.path.startsWith("/") && !s.path.startsWith("./") && !s.path.startsWith("../")) {
						s.path = `./${s.path}`;
					}

					return {
						path: s.path,
						isDir: s.isDir,
						uploaded: s.uploaded ? UploadStatus.Uploaded : UploadStatus.NotUploaded,
					};
				})
			);

			setTemplates(
				templates.map((t) => {
					if (!t.path.startsWith("/") && !t.path.startsWith("./") && !t.path.startsWith("../")) {
						t.path = `./${t.path}`;
					}

					return {
						path: t.path,
						isDir: t.isDir,
						uploaded: t.uploaded ? UploadStatus.Uploaded : UploadStatus.NotUploaded,
					};
				})
			);
		};

		fetchNeeded();
	}, []);

	const uploadCallback = (path: string, state: UploadStatus) => {
		const template = templates.find((f) => f.path === path);
		if (template) {
			template.uploaded = state;
			setTemplates([...templates]);
		}

		const secret = secrets.find((f) => f.path === path);
		if (secret) {
			secret.uploaded = state;
			setSecrets([...secrets]);
		}
	};

	// Returns true if the given path is one that we expect to upload. Basic sanity
	// check to make sure we're not gobbling up files that we don't want.
	const validateFile = (path: string) => {
		// Secrets are always single files.
		if (secrets.map((s) => s.path).includes(path)) {
			return true;
		}

		// Templates might be a glob, so first check single files.
		if (templates.map((t) => t.path).includes(path)) {
			return true;
		}

		const parts = path.split(new RegExp(`[/\\\\]`));
		if (parts.length >= 2) {
			const maybeGlob = parts[parts.length - 2];
			if (maybeGlob.includes("*")) {
				const globRegex = new RegExp(maybeGlob.replace(".", "\\.").replace("*", ".*").replace("?", "."));

				const fileName = parts[parts.length - 1];
				return globRegex.test(fileName);
			}
		}

		return false;
	};

	const selectedClass = "selected";
	const onClick = (e: MouseEvent) => {
		e.stopPropagation();
		if (selected) {
			selected.classList.remove(selectedClass);
		}

		(e.currentTarget as HTMLLIElement).classList.add(selectedClass);
		setSelected(e.currentTarget as HTMLLIElement);
	};

	let selectedData;
	if (selected) {
		selectedData = {
			isDir: selected.dataset["isDir"] === "true",
			path: selected.dataset["filePath"],
		};
	}

	const allUploaded =
		secrets.every((s) => s.uploaded === UploadStatus.Uploaded) &&
		templates.every((t) => t.uploaded === UploadStatus.Uploaded);

	let progressButton;
	if (allUploaded) {
		progressButton = <button class="p-2 bg-green-600 rounded my-3">Let's go!</button>;
	} else {
		progressButton = <button class="p-2 bg-yellow-600 rounded my-3">Skip!</button>;
	}

	return (
		<>
			<h1 class="text-3xl font-bold my-3">We're gonna need a few extra files</h1>

			<span class="flex flex-row justify-between">
				<h2 class="text-lg my-3 basis-3/4">
					Your config has a few external files that we'll need. You can upload them now, or wait until later. Things
					will continue to work, but any receivers that use un-uploaded files might not.
				</h2>

				{progressButton}
			</span>

			<div class="flex flex-row justify-between flex-grow">
				<div class="flex flex-col justify-between overflow-scroll">
					{templates.length > 0 && (
						<span class="list-tree">
							<h2 class="text-lg my-3 font-bold">Templates</h2>
							<ul>{trieToList("", buildTrie(templates), onClick)}</ul>
						</span>
					)}

					{secrets.length > 0 && (
						<span class="list-tree">
							<h2 class="text-lg my-3 font-bold">Secrets</h2>
							<ul>{trieToList("", buildTrie(secrets), onClick)}</ul>
						</span>
					)}
				</div>

				<UploadBox selected={selectedData} uploadCallback={uploadCallback} validateFile={validateFile} />
			</div>
		</>
	);
};
