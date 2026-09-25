"use client";

import {
  EmailEditor as BaseEmailEditor,
  type EmailEditorProps as BaseEmailEditorProps,
  type EmailEditorRef as BaseEmailEditorRef,
} from "@react-email/editor";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";

import "@react-email/editor/themes/default.css";

export type ReactEmailDocument = ReturnType<BaseEmailEditorRef["getJSON"]>;

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
  // eslint-disable-next-line no-unused-vars
  setContent: (content: ReactEmailDocument | string) => void;
}

export interface ReactEmailEditorProps extends Omit<
  BaseEmailEditorProps,
  "onReady" | "onUpdate" | "ref"
> {
  // eslint-disable-next-line no-unused-vars
  onDocumentChange?: (document: ReactEmailDocument) => void;
  // eslint-disable-next-line no-unused-vars
  onReady?: (ref: ReactEmailEditorRef) => void;
}

const emptyDocument: ReactEmailDocument = { type: "doc", content: [] };

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
    setContent: (content) => {
      getRef()?.editor?.commands.setContent(content);
    },
  };
}

export const ReactEmailEditor = forwardRef<
  ReactEmailEditorRef,
  ReactEmailEditorProps
>(function ReactEmailEditor(
  { className, onDocumentChange, onReady, ...props },
  forwardedRef,
) {
  const editorRef = useRef<BaseEmailEditorRef>(null);

  useImperativeHandle(
    forwardedRef,
    () => toPublicRef(() => editorRef.current),
    [],
  );

  const handleReady = useCallback(
    (ref: BaseEmailEditorRef) => {
      editorRef.current = ref;
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
