// Cloudflare may consume its documented per-address email_off directives.
// The two exact delivery forms differ only by that one non-rendering wrapper.
// Do not normalize the email value, form markup, scripts or any other bytes.
export function matchesPublishedContent(actual, expected, allowEmailMarkerRemoval = false) {
  if (actual === expected) return true;
  if (!allowEmailMarkerRemoval) return false;
  const edgeExpected = expected.replace(
    /<span><!--email_off-->([^<>]+)<!--\/email_off--><\/span>/,
    '<span>$1</span>'
  );
  return edgeExpected !== expected && actual === edgeExpected;
}
