import { useState } from "preact/hooks";
import { CreateSilence } from "./create";
import { PreviewProps, PreviewSilence } from "./preview";

export const NewSilence = () => {
	const [previewData, setPreviewData] = useState<PreviewProps | undefined>();
	return (
		<div class="w-full h-full flex flex-col justify-between">
			{(!previewData && <CreateSilence onPreview={(p) => setPreviewData(p)} />) || <PreviewSilence {...previewData} />}
		</div>
	);
};
