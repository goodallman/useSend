"use client";

import {
  EmailEditor as BaseEmailEditor,
  type EmailEditorProps as BaseEmailEditorProps,
  type EmailEditorRef as BaseEmailEditorRef,
} from "@react-email/editor";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  getSelectionAlignment,
  setTextAlignment,
} from "@react-email/editor/utils";

import "@react-email/editor/themes/default.css";
import "./noyra-editor.css";

export type ReactEmailDocument = ReturnType<BaseEmailEditorRef["getJSON"]>;
export type ReactEmailBlockType =
  "paragraph" | "heading1" | "heading2" | "heading3";

export const DEFAULT_REACT_EMAIL_DOCUMENT: ReactEmailDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Your headline" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hi {{firstName,fallback=there}}," }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Write a clear message your audience will want to read.",
        },
      ],
    },
    {
      type: "button",
      attrs: {
        href: "https://example.com",
        style:
          "background-color: #111827; color: #ffffff; border-radius: 8px; padding: 12px 20px;",
      },
      content: [{ type: "text", text: "Call to action" }],
    },
  ],
};

export interface ReactEmailEditorRef {
  getDocument: () => ReactEmailDocument;
  getEmail: BaseEmailEditorRef["getEmail"];
  getHTML: BaseEmailEditorRef["getEmailHTML"];
  getText: BaseEmailEditorRef["getEmailText"];
  // eslint-disable-next-line no-unused-vars
  insertVariable: (name: string, fallback?: string) => void;
  insertUnsubscribe: () => void;
  insertButton: () => void;
  insertDivider: () => void;
  undo: () => void;
  redo: () => void;
  // eslint-disable-next-line no-unused-vars
  setBlockType: (type: ReactEmailBlockType) => void;
  // eslint-disable-next-line no-unused-vars
  setTextAlignment: (alignment: "left" | "center" | "right") => void;
  // eslint-disable-next-line no-unused-vars
  toggleMark: (mark: "bold" | "italic" | "underline" | "strike") => void;
  // eslint-disable-next-line no-unused-vars
  updateSelectedLink: (href: string) => void;
  // eslint-disable-next-line no-unused-vars
  updateSelectedButton: (value: Partial<ReactEmailButtonState>) => void;
  deleteSelectedButton: () => void;
  // eslint-disable-next-line no-unused-vars
  setContent: (content: ReactEmailDocument | string) => void;
}

export interface ReactEmailButtonState {
  text: string;
  href: string;
  style: string;
  alignment: "left" | "center" | "right";
}

export interface ReactEmailEditorState {
  blockType: "paragraph" | "heading1" | "heading2" | "heading3";
  alignment: "left" | "center" | "right";
  marks: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
  };
  hasTextSelection: boolean;
  linkHref: string;
  button: ReactEmailButtonState | null;
}

export interface ReactEmailEditorProps extends Omit<
  BaseEmailEditorProps,
  "onReady" | "onUpdate" | "ref"
> {
  // eslint-disable-next-line no-unused-vars
  onDocumentChange?: (document: ReactEmailDocument) => void;
  // eslint-disable-next-line no-unused-vars
  onReady?: (ref: ReactEmailEditorRef) => void;
  // eslint-disable-next-line no-unused-vars
  onSelectionChange?: (state: ReactEmailEditorState) => void;
}

const emptyDocument: ReactEmailDocument = { type: "doc", content: [] };

type EditorInstance = NonNullable<BaseEmailEditorRef["editor"]>;
type EditorNode = NonNullable<
  ReturnType<EditorInstance["state"]["doc"]["nodeAt"]>
>;

function findActiveButton(
  editor: EditorInstance,
): { node: EditorNode; pos: number } | null {
  const { selection } = editor.state;
  const selectedNode = (
    "node" in selection ? selection.node : null
  ) as EditorNode | null;
  if (selectedNode?.type.name === "button") {
    return { node: selectedNode, pos: selection.from };
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth);
    if (node.type.name === "button") {
      return { node, pos: selection.$from.before(depth) };
    }
  }

  return null;
}

function getEditorState(editor: EditorInstance): ReactEmailEditorState {
  const activeButton = findActiveButton(editor);
  const headingLevel = editor.getAttributes("heading").level as
    number | undefined;
  const alignment = getSelectionAlignment(editor);

  return {
    blockType: editor.isActive("heading")
      ? (`heading${headingLevel ?? 1}` as ReactEmailEditorState["blockType"])
      : "paragraph",
    alignment:
      alignment === "center" || alignment === "right" ? alignment : "left",
    marks: {
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
    },
    hasTextSelection: !editor.state.selection.empty,
    linkHref: String(editor.getAttributes("link").href ?? ""),
    button: activeButton
      ? {
          text: activeButton.node.textContent,
          href: String(activeButton.node.attrs.href ?? ""),
          style: String(activeButton.node.attrs.style ?? ""),
          alignment:
            activeButton.node.attrs.alignment === "center" ||
            activeButton.node.attrs.alignment === "right"
              ? activeButton.node.attrs.alignment
              : "left",
        }
      : null,
  };
}

function toPublicRef(
  getRef: () => BaseEmailEditorRef | null,
): ReactEmailEditorRef {
  return {
    getDocument: () => getRef()?.getJSON() ?? emptyDocument,
    getEmail: async () => getRef()?.getEmail() ?? { html: "", text: "" },
    getHTML: async () => getRef()?.getEmailHTML() ?? "",
    getText: async () => getRef()?.getEmailText() ?? "",
    insertVariable: (name, fallback) => {
      const value = fallback
        ? `{{${name},fallback=${fallback}}}`
        : `{{${name}}}`;
      getRef()?.editor?.chain().focus().insertContent(value).run();
    },
    insertUnsubscribe: () => {
      getRef()
        ?.editor?.chain()
        .focus()
        .insertContent(
          '<p style="text-align: center; color: #6b7280; font-size: 12px"><a href="{{usesend_unsubscribe_url}}">Unsubscribe</a></p>',
        )
        .run();
    },
    insertButton: () => {
      getRef()
        ?.editor?.chain()
        .focus()
        .insertContent({
          type: "button",
          content: [{ type: "text", text: "Button" }],
        })
        .run();
    },
    insertDivider: () => {
      getRef()
        ?.editor?.chain()
        .focus()
        .insertContent({ type: "horizontalRule" })
        .run();
    },
    undo: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      (editor.commands as unknown as { undo: () => boolean }).undo();
    },
    redo: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      (editor.commands as unknown as { redo: () => boolean }).redo();
    },
    setBlockType: (type) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      if (type === "paragraph") {
        editor.chain().focus().clearNodes().setNode("paragraph").run();
        return;
      }
      const level = Number(type.slice(-1)) as 1 | 2 | 3;
      editor.chain().focus().clearNodes().setNode("heading", { level }).run();
    },
    setTextAlignment: (alignment) => {
      const editor = getRef()?.editor;
      if (editor) setTextAlignment(editor, alignment);
    },
    toggleMark: (mark) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      editor.chain().focus().toggleMark(mark).run();
    },
    updateSelectedLink: (href) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      if (!href.trim()) {
        editor.chain().focus().extendMarkRange("link").unsetMark("link").run();
        return;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setMark("link", { href: href.trim() })
        .run();
    },
    updateSelectedButton: (value) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      const activeButton = findActiveButton(editor);
      if (!activeButton) return;

      const attrs = {
        ...activeButton.node.attrs,
        ...(value.href === undefined ? {} : { href: value.href }),
        ...(value.style === undefined ? {} : { style: value.style }),
        ...(value.alignment === undefined
          ? {}
          : { alignment: value.alignment }),
      };
      const transaction = editor.state.tr;

      if (
        value.text !== undefined &&
        value.text !== activeButton.node.textContent
      ) {
        const text = value.text.trim() ? value.text : "Button";
        const marks = activeButton.node.content.firstChild?.marks ?? [];
        const replacement = activeButton.node.type.create(
          attrs,
          editor.schema.text(text, marks),
          activeButton.node.marks,
        );
        transaction.replaceWith(
          activeButton.pos,
          activeButton.pos + activeButton.node.nodeSize,
          replacement,
        );
      } else {
        transaction.setNodeMarkup(activeButton.pos, null, attrs);
      }

      editor.view.dispatch(transaction);
      editor.commands.setNodeSelection(activeButton.pos);
    },
    deleteSelectedButton: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      const activeButton = findActiveButton(editor);
      if (!activeButton) return;
      editor
        .chain()
        .focus()
        .deleteRange({
          from: activeButton.pos,
          to: activeButton.pos + activeButton.node.nodeSize,
        })
        .run();
    },
    setContent: (content) => {
      getRef()?.editor?.commands.setContent(content);
    },
  };
}

export const ReactEmailEditor = forwardRef<
  ReactEmailEditorRef,
  ReactEmailEditorProps
>(function ReactEmailEditor(
  { className, onDocumentChange, onReady, onSelectionChange, ...props },
  forwardedRef,
) {
  const editorRef = useRef<BaseEmailEditorRef>(null);
  const selectionCleanupRef = useRef<(() => void) | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => () => selectionCleanupRef.current?.(), []);

  useImperativeHandle(
    forwardedRef,
    () => toPublicRef(() => editorRef.current),
    [],
  );

  const handleReady = useCallback(
    (ref: BaseEmailEditorRef) => {
      editorRef.current = ref;
      selectionCleanupRef.current?.();
      const notifySelection = () => {
        if (ref.editor)
          onSelectionChangeRef.current?.(getEditorState(ref.editor));
      };
      ref.editor?.on("selectionUpdate", notifySelection);
      ref.editor?.on("transaction", notifySelection);
      selectionCleanupRef.current = () => {
        ref.editor?.off("selectionUpdate", notifySelection);
        ref.editor?.off("transaction", notifySelection);
      };
      notifySelection();
      onReady?.(toPublicRef(() => ref));
    },
    [onReady],
  );

  const handleUpdate = useCallback(
    (ref: BaseEmailEditorRef) => {
      editorRef.current = ref;
      onDocumentChange?.(ref.getJSON());
    },
    [onDocumentChange],
  );

  return (
    <BaseEmailEditor
      {...props}
      ref={editorRef}
      className={`noyra-react-email-editor ${className ?? ""}`}
      onReady={handleReady}
      onUpdate={handleUpdate}
    />
  );
});
