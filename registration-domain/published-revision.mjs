// An hourly recovery publication may advance only the marker while delivering
// identical registration bytes. Content checks remain independent and exact.
export async function matchesPublishedRevision(actual, expected, compare) {
  if (!/^[a-f0-9]{40}$/.test(expected) || !/^[a-f0-9]{40}\n$/.test(actual)) return false;
  const published = actual.slice(0, -1);
  if (published === expected) return true;
  try {
    const result = await compare(expected, published);
    return result.status === 'ahead' && result.behind_by === 0 && result.ahead_by > 0 &&
      result.merge_base_commit?.sha === expected;
  } catch {
    return false;
  }
}
