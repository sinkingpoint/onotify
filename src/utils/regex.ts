// getAnchoredRegex returns a RegExp of the given regex, anchored
// so that it only matches exact strings.
export const getAnchoredRegex = (
  r: string,
  cache?: Record<string, RegExp>
): RegExp => {
  if (!r.startsWith("^")) {
    r = `^${r}`;
  }

  if (!r.endsWith("$")) {
    r = `${r}$`;
  }

  if (cache && cache[r]) {
    return cache[r];
  }

  const regexp = new RegExp(r);

  if (cache) {
    cache[r] = regexp;
  }

  return regexp;
};
