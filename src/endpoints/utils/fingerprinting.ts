type Fingerprint = bigint;

const offset64 = BigInt("14695981039346656037");
const prime64 = BigInt("1099511628211");

// SeparatorByte is a byte that cannot occur in valid UTF-8 sequences and is
// used to separate label names, label values, and other strings from each other
// when calculating their combined hash value (aka signature aka fingerprint).
const seperatorByte = 255;

const newFingerprint = (): Fingerprint => {
  return BigInt.asUintN(64, offset64);
};

const hashAdd = (current: bigint, s: string): Fingerprint => {
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    current ^= BigInt(char);
    current *= prime64;
  }

  return BigInt.asUintN(64, current);
};

const hashAddByte = (current: bigint, b: number): Fingerprint => {
  current ^= BigInt(b);
  current *= prime64;
  return BigInt.asUintN(64, current);
};

const emptyHash = newFingerprint();

export const fingerprint = (r: Record<string, string>): Fingerprint => {
  if (Object.keys(r).length === 0) {
    return emptyHash;
  }

  const labelNames = [];
  for (const label of Object.keys(r)) {
    labelNames.push(label);
  }

  labelNames.sort();

  let sum = newFingerprint();
  for (const labelName of labelNames) {
    sum = hashAdd(sum, labelName);
    sum = hashAddByte(sum, seperatorByte);
    sum = hashAdd(sum, r[labelName]);
    sum = hashAddByte(sum, seperatorByte);
  }

  return sum;
};

export const fingerprintArray = (a: string[]) => {
  let sum = newFingerprint();
  for(const val of a) {
    sum = hashAdd(sum, val);
    sum = hashAddByte(sum, seperatorByte);
  }

  return sum;
}