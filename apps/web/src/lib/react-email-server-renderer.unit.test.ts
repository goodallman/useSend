import { describe, expect, it } from "vitest";

import { renderReactEmailDocument } from "@usesend/react-email-editor/src/server-renderer";

describe("renderReactEmailDocument", () => {
  it("renders editor JSON without loading the browser editor", async () => {
    const document = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            {
              type: "text",
              text: "Hello & welcome",
              marks: [{ type: "bold" }],
            },
          ],
        },
        {
          type: "button",
          attrs: {
            alignment: "center",
            href: "https://example.com",
            style: "background-color: #111827; color: #ffffff;",
          },
          content: [{ type: "text", text: "Open" }],
        },
      ],
    };

    const output = await renderReactEmailDocument(document as never);

    expect(output.html).toContain("<strong>Hello &amp; welcome</strong>");
    expect(output.html).toContain('href="https://example.com"');
    expect(output.html).toContain("text-align: center");
    expect(output.text).toBe("Hello & welcome\nOpen");
  });
});
