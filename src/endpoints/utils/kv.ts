export const globalTreeKVKey = (account_id: string) => {
	return `onotify-${account_id}-global`;
};

export const routingTreeKVKey = (account_id: string) => {
	return `onotify-${account_id}-routing-tree`;
};

export const receiversKVKey = (account_id: string) => {
	return `onotify-${account_id}-receivers`;
};

export const inhibitionsKVKey = (account_id: string): string => {
	return `onotify-${account_id}-inhibititions`;
};

export const timeIntervalsKVKey = (account_id: string): string => {
	return `onotify-${account_id}-time-intervals`;
};

export const requiredFilesKey = (account_id: string): string => {
	return `onotify-${account_id}-required-files`;
};

export const uploadedFilesKey = (account_id: string): string => {
	return `onotify-${account_id}-uploaded-files`;
};

export const alertGroupControllerName = (accountID: string, nodeID: string, groupLabels: string[]) => {
	return `alert-group-controller-${accountID}-${nodeID}-${groupLabels}`;
};

export const accountControllerName = (accountID: string) => {
	return `account-controller-${accountID}`;
};
