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
