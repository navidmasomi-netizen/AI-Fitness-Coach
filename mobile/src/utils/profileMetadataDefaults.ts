export function getProfileMetadataDefaults() {
  let timezone = "UTC";

  try {
    const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolvedTimezone) {
      timezone = resolvedTimezone;
    }
  } catch {
    timezone = "UTC";
  }

  return {
    preferredLanguage: "en",
    timezone,
    units: "metric",
  };
}
