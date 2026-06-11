const write = (level, event, details = {}) => {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([, value])=>value !== undefined && value !== null)
  );

  console[level](JSON.stringify({
    timestamp:new Date().toISOString(),
    type:"security_event",
    event,
    ...safeDetails
  }));
};

exports.securityInfo = (event, details) => write("info", event, details);
exports.securityWarn = (event, details) => write("warn", event, details);
exports.securityError = (event, details) => write("error", event, details);
