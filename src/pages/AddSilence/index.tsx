import { useState } from "preact/hooks";
import { CreateSilence } from "./create";
import { PreviewProps, PreviewSilence } from "./preview";

export default () => {
	const [previewData, setPreviewData] = useState<PreviewProps | undefined>();
	return (
		<div class="w-full h-full flex flex-col justify-between">
			<h1 class="text-3xl mb-6 mt-6 font-bold">New Silence</h1>
			{(!previewData && <CreateSilence onPreview={(p) => setPreviewData(p)} />) || <PreviewSilence {...previewData} />}
		</div>
	);
};
