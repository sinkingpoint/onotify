import { CachedAlert } from "types/internal";
import { Template } from "@sinkingpoint/gotemplate";

export type Notifier<C> = (
	name: string,
	config: C,
	template: Template,
	loadUploadedFile: (filename: string) => Promise<string | null>,
	alerts: CachedAlert[],
	groupLabels: Record<string, string>,
) => Promise<void>;
