import crypto from "node:crypto";

function sanitizeOptionalHeader(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 128) {
    return null;
  }

  return normalized;
}

export function attachRequestContext(req, res, next) {
  const requestId = crypto.randomUUID();
  const replacementFlowId = sanitizeOptionalHeader(req.headers?.["x-replacement-flow-id"]);

  req.requestContext = Object.freeze({
    requestId,
    replacementFlowId,
  });

  res.locals.requestContext = req.requestContext;
  next();
}
