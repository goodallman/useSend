// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import {
  createReactEmailContent,
  ReactEmailEditor,
  type ReactEmailDocument,
  type ReactEmailEditorRef,
  type ReactEmailEditorState,
} from "@usesend/react-email-editor";
import { ReactEmailComposer } from "./react-email-composer";

Object.assign(window, { IS_REACT_ACT_ENVIRONMENT: true });

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of mounted.splice(0)) cleanup();
});

it("keeps the composer editable after a document update", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });

  await act(async () => {
    root.render(
      React.createElement(ReactEmailComposer, {
        html: "<p>Hello</p>",
        content: JSON.stringify(
          createReactEmailContent({
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
            ],
          }),
        ),
        variables: ["firstName"],
        uploadImage: async () => "https://example.com/image.png",
        onSave: async () => {},
      }),
    );
  });
  const content = host.querySelector<HTMLElement>(".tiptap");
  const text = content?.querySelector("p")?.firstChild;
  expect(content).not.toBeNull();
  expect(text).not.toBeNull();

  await act(async () => {
    content!.focus();
    window.getSelection()!.collapse(text!, 5);
    content!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(content?.querySelectorAll("p").length).toBe(2);
  expect(document.activeElement).toBe(content);
});

it("splits a paragraph when Enter is pressed", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  let editor: ReactEmailEditorRef | null = null;

  await act(async () => {
    root.render(
      React.createElement(ReactEmailEditor, {
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
          ],
        },
        onReady: (value) => {
          editor = value;
        },
      }),
    );
  });
  await vi.waitFor(() => expect(editor).not.toBeNull());
  const content = host.querySelector<HTMLElement>(".tiptap");
  const text = content?.querySelector("p")?.firstChild;
  expect(content).not.toBeNull();
  expect(text).not.toBeNull();

  await act(async () => {
    content!.focus();
    window.getSelection()!.collapse(text!, 5);
    content!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });

  expect(editor!.getDocument().content?.map((node) => node.type)).toEqual([
    "container",
  ]);
  expect(
    editor!.getDocument().content?.[0]?.content?.map((node) => node.type),
  ).toEqual(["paragraph", "paragraph"]);
});

it.each([
  [
    "heading",
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "Hello" }],
    },
  ],
  [
    "section",
    {
      type: "section",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    },
  ],
  [
    "columns",
    {
      type: "twoColumns",
      content: [
        {
          type: "columnsColumn",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
          ],
        },
        { type: "columnsColumn", content: [{ type: "paragraph" }] },
      ],
    },
  ],
  [
    "link",
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Hello",
          marks: [{ type: "link", attrs: { href: "https://example.com" } }],
        },
      ],
    },
  ],
  [
    "quote",
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    },
  ],
] as const)("splits text inside %s on Enter", async (_name, block) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  let editor: ReactEmailEditorRef | null = null;

  await act(async () => {
    root.render(
      React.createElement(ReactEmailEditor, {
        content: {
          type: "doc",
          content: [
            block as unknown as NonNullable<
              ReactEmailDocument["content"]
            >[number],
          ],
        },
        onReady: (value) => {
          editor = value;
        },
      }),
    );
  });
  await vi.waitFor(() => expect(editor).not.toBeNull());
  const content = host.querySelector<HTMLElement>(".tiptap");
  const walker = document.createTreeWalker(content!, NodeFilter.SHOW_TEXT);
  let text: Node | null = null;
  while (walker.nextNode()) {
    if (walker.currentNode.textContent === "Hello") {
      text = walker.currentNode;
      break;
    }
  }
  expect(text).not.toBeNull();
  const countBlocks = (
    nodes: NonNullable<
      ReturnType<ReactEmailEditorRef["getDocument"]>["content"]
    >,
  ): number =>
    nodes.reduce(
      (count, node) =>
        count +
        (node.type === "paragraph" || node.type === "heading" ? 1 : 0) +
        countBlocks(node.content ?? []),
      0,
    );
  const before = countBlocks(editor!.getDocument().content ?? []);

  await act(async () => {
    content!.focus();
    window.getSelection()!.collapse(text!, 5);
    content!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(countBlocks(editor!.getDocument().content ?? [])).toBe(before + 1);
  if (_name === "heading") {
    expect(
      editor!
        .getDocument()
        .content?.[0]?.content?.slice(0, 2)
        .map((node) => node.type),
    ).toEqual(["heading", "paragraph"]);
  }
});

it("treats a selected layout as a block rather than selected text", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  let editor: ReactEmailEditorRef | null = null;
  const states: ReactEmailEditorState[] = [];

  await act(async () => {
    root.render(
      React.createElement(ReactEmailEditor, {
        content: {
          type: "doc",
          content: [
            {
              type: "twoColumns",
              content: [
                {
                  type: "columnsColumn",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Hello" }],
                    },
                  ],
                },
                { type: "columnsColumn", content: [{ type: "paragraph" }] },
              ],
            },
          ],
        },
        onReady: (value) => {
          editor = value;
        },
        onSelectionChange: (value) => {
          states.push(value);
        },
      }),
    );
  });
  await vi.waitFor(() => expect(editor).not.toBeNull());
  const content = host.querySelector<HTMLElement>(".tiptap")!;
  const text = content.querySelector(".node-column p")!.firstChild!;
  await act(async () => {
    content.focus();
    window.getSelection()!.collapse(text, 2);
  });
  await act(async () => editor!.selectLayoutBlock());
  expect(states.at(-1)?.selectedBlock?.isSelected).toBe(true);
  expect(states.at(-1)?.hasTextSelection).toBe(false);
});

it("exits a list when Enter is pressed in an empty item", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  let editor: ReactEmailEditorRef | null = null;

  await act(async () => {
    root.render(
      React.createElement(ReactEmailEditor, {
        content: {
          type: "doc",
          content: [
            {
              type: "bulletList",
              content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
            },
          ],
        },
        onReady: (value) => {
          editor = value;
        },
      }),
    );
  });
  await vi.waitFor(() => expect(editor).not.toBeNull());
  const content = host.querySelector<HTMLElement>(".tiptap")!;
  await act(async () => {
    content.focus();
    window.getSelection()!.collapse(content.querySelector("li p")!, 0);
    content.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });

  expect(content.querySelectorAll("li")).toHaveLength(0);
  expect(content.querySelectorAll("p").length).toBeGreaterThan(0);
});
