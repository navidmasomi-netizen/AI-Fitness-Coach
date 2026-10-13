type StatusError = {
  status?: unknown;
};

export function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;

  const status = (error as StatusError).status;
  return typeof status === "number" ? status : null;
}

export function isUnauthorizedError(error: unknown): boolean {
  return getErrorStatus(error) === 401;
}

export function getProfileLoadErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);

  if (status === 0) {
    return "We couldn't reach the server. Check your connection and try again.";
  }

  if (status !== null && status >= 500) {
    return "The server is temporarily unavailable. Please try again.";
  }

  return "We couldn't load your profile. Please try again.";
}
