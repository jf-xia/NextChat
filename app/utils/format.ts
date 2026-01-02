export function prettyObject(msg: any) {
  if (msg?.error) {
    // Support multiple shapes:
    // - { error: { message: string, type?: string } }
    // - { error: true, msg: "..." }
    // - { error: true, message: "..." }
    // - { error: "some string" }
    const errorFromErrorObj =
      msg?.error && typeof msg.error !== "boolean" && typeof msg.error !== "string"
        ? msg.error.message
        : typeof msg.error === "string"
        ? msg.error
        : undefined;

    const errorMessage =
      errorFromErrorObj ?? msg?.msg ?? msg?.message ?? JSON.stringify(msg);

    const sanitizedMessage =
      typeof errorMessage === "string"
        ? errorMessage.replace(/litellm/g, "Error")
        : JSON.stringify(errorMessage);

    const errorType =
      (msg?.error && typeof msg.error !== "boolean" ? msg.error.type : undefined) ??
      (msg?.error && typeof msg.error === "string" ? "StringError" : undefined) ??
      "Unknown";

    return sanitizedMessage + "\n\n (chat_ai_error_msg: " + errorType + ")";
  }
  const obj = msg;
  if (typeof msg !== "string") {
    msg = JSON.stringify(msg, null, "  ");
  }
  if (msg === "{}") {
    return obj.toString();
  }

  if (msg.startsWith("```json")) {
    return msg;
  }
  return ["```json", msg, "```"].join("\n");
}

export function* chunks(s: string, maxBytes = 1000 * 1000) {
  const decoder = new TextDecoder("utf-8");
  let buf = new TextEncoder().encode(s);
  while (buf.length) {
    let i = buf.lastIndexOf(32, maxBytes + 1);
    // If no space found, try forward search
    if (i < 0) i = buf.indexOf(32, maxBytes);
    // If there's no space at all, take all
    if (i < 0) i = buf.length;
    // This is a safe cut-off point; never half-way a multi-byte
    yield decoder.decode(buf.slice(0, i));
    buf = buf.slice(i + 1); // Skip space (if any)
  }
}
