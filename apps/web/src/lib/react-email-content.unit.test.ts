import { describe, expect, it } from "vitest";
import {
  createReactEmailContent,
  isReactEmailContent,
  parseReactEmailContent,
  type ReactEmailDocument,
} from "@usesend/react-email-editor";

const document: ReactEmailDocument = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

describe("React Email content format", () => {
  it("round-trips versioned visual content", () => {
    const encoded = JSON.stringify(createReactEmailContent(document));

    expect(isReactEmailContent(encoded)).toBe(true);
    expect(parseReactEmailContent(encoded)).toEqual({
      editor: "react-email",
      version: 1,
      document,
    });
  });

  it("keeps an HTML override alongside the editable document", () => {
    const encoded = JSON.stringify(
      createReactEmailContent(document, "<p>Custom HTML</p>"),
    );

    expect(parseReactEmailContent(encoded)?.htmlOverride).toBe(
      "<p>Custom HTML</p>",
    );
  });

  it("does not misclassify legacy TipTap or malformed content", () => {
    expect(isReactEmailContent(JSON.stringify(document))).toBe(false);
    expect(isReactEmailContent("not-json")).toBe(false);
    expect(
      isReactEmailContent(
        JSON.stringify({ editor: "react-email", version: 2, document }),
      ),
    ).toBe(false);
  });
});
