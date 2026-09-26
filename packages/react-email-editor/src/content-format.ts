import type { ReactEmailDocument } from "./react-email-editor";

export const REACT_EMAIL_CONTENT_EDITOR = "react-email" as const;
export const REACT_EMAIL_CONTENT_VERSION = 1 as const;

export interface ReactEmailContentEnvelope {
  editor: typeof REACT_EMAIL_CONTENT_EDITOR;
  version: typeof REACT_EMAIL_CONTENT_VERSION;
  document: ReactEmailDocument;
  htmlOverride?: string;
}

export function createReactEmailContent(
  document: ReactEmailDocument,
  htmlOverride?: string,
): ReactEmailContentEnvelope {
  return {
    editor: REACT_EMAIL_CONTENT_EDITOR,
    version: REACT_EMAIL_CONTENT_VERSION,
    document,
    ...(htmlOverride ? { htmlOverride } : {}),
  };
}

export function parseReactEmailContent(
  content: string | null | undefined,
): ReactEmailContentEnvelope | null {
  if (!content) return null;

  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "editor" in parsed &&
      parsed.editor === REACT_EMAIL_CONTENT_EDITOR &&
      "version" in parsed &&
      parsed.version === REACT_EMAIL_CONTENT_VERSION &&
      "document" in parsed &&
      typeof parsed.document === "object" &&
      parsed.document !== null
    ) {
      return parsed as ReactEmailContentEnvelope;
    }
  } catch {
    return null;
  }

  return null;
}

export function isReactEmailContent(content: string | null | undefined) {
  return parseReactEmailContent(content) !== null;
}
