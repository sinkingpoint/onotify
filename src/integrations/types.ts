import { CachedAlert } from "types/internal";

export type Notifier<C> = (
	name: string,
	config: C,
	alerts: CachedAlert[],
	groupLabels: Record<string, string>,
) => Promise<void>;
