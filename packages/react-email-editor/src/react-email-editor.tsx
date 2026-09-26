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
export type ReactEmailLayoutType =
  "section" | "twoColumns" | "threeColumns" | "fourColumns";

export interface ReactEmailSelectedBlock {
  type: ReactEmailLayoutType | "horizontalRule";
  isSelected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const DEFAULT_BUBBLE_MENU: NonNullable<BaseEmailEditorProps["bubbleMenu"]> = {
  hideWhenActiveNodes: ["button", "horizontalRule"],
  hideWhenActiveMarks: ["link"],
};

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
        style: "background-color: #111827; color: #ffffff; border-radius: 8px;",
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
  // eslint-disable-next-line no-unused-vars
  insertLayout: (type: ReactEmailLayoutType) => void;
  // eslint-disable-next-line no-unused-vars
  toggleBlock: (type: "bulletList" | "orderedList" | "blockquote") => void;
  selectLayoutBlock: () => void;
  deleteSelectedBlock: () => void;
  // eslint-disable-next-line no-unused-vars
  moveSelectedBlock: (direction: "up" | "down") => void;
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
  selectedBlock: ReactEmailSelectedBlock | null;
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
type TextSelectionRange = { from: number; to: number };
type EditorActionHistory = {
  undo: ReactEmailDocument[];
  redo: ReactEmailDocument[];
};
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

const layoutTypes = new Set<string>([
  "section",
  "twoColumns",
  "threeColumns",
  "fourColumns",
]);

function findSelectedBlock(editor: EditorInstance) {
  const { selection } = editor.state;
  const selectedNode = (
    "node" in selection ? selection.node : null
  ) as EditorNode | null;
  if (
    selectedNode &&
    (selectedNode.type.name === "horizontalRule" ||
      layoutTypes.has(selectedNode.type.name))
  ) {
    return { node: selectedNode, pos: selection.from };
  }
  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth);
    if (layoutTypes.has(node.type.name)) {
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
  const selectedBlock = findSelectedBlock(editor);
  const blockParent = selectedBlock
    ? editor.state.doc.resolve(selectedBlock.pos).parent
    : null;
  const blockIndex =
    selectedBlock && blockParent
      ? editor.state.doc.resolve(selectedBlock.pos).index()
      : -1;

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
    hasTextSelection:
      !editor.state.selection.empty && !("node" in editor.state.selection),
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
    selectedBlock:
      selectedBlock && blockParent
        ? {
            type: selectedBlock.node.type
              .name as ReactEmailSelectedBlock["type"],
            isSelected:
              "node" in editor.state.selection &&
              editor.state.selection.node === selectedBlock.node,
            canMoveUp: blockIndex > 0,
            canMoveDown: blockIndex < blockParent.childCount - 1,
          }
        : null,
  };
}

function toPublicRef(
  getRef: () => BaseEmailEditorRef | null,
  getTextSelection: () => TextSelectionRange | null,
  getButtonPosition: () => number | null,
  getBlockPosition: () => number | null,
  getSelectedBlockState: () => ReactEmailSelectedBlock | null,
  actionHistory: EditorActionHistory,
): ReactEmailEditorRef {
  const recordAction = (editor: EditorInstance) => {
    actionHistory.undo.push(editor.getJSON());
    if (actionHistory.undo.length > 100) actionHistory.undo.shift();
    actionHistory.redo.length = 0;
  };
  const restoreTextSelection = (editor: EditorInstance) => {
    const selection = getTextSelection();
    return selection
      ? editor
          .chain()
          .focus()
          .setTextSelection({
            from: Math.min(selection.from, editor.state.doc.content.size),
            to: Math.min(selection.to, editor.state.doc.content.size),
          })
      : editor.chain().focus();
  };
  const getEditableButton = (editor: EditorInstance) => {
    const activeButton = findActiveButton(editor);
    if (activeButton) return activeButton;
    const position = getButtonPosition();
    if (position === null) return null;
    const node = editor.state.doc.nodeAt(position);
    return node?.type.name === "button" ? { node, pos: position } : null;
  };
  const getEditableBlock = (editor: EditorInstance) => {
    if (editor.isFocused) {
      const active = findSelectedBlock(editor);
      if (active) return active;
    }
    const position = getBlockPosition();
    if (position === null) return null;
    const node = editor.state.doc.nodeAt(position);
    return node &&
      (node.type.name === "horizontalRule" || layoutTypes.has(node.type.name))
      ? { node, pos: position }
      : null;
  };
  const getBlockInsertionPosition = (editor: EditorInstance) => {
    const savedSelection = getTextSelection();
    const { selection } = editor.state;
    const $from = savedSelection
      ? editor.state.doc.resolve(
          Math.min(savedSelection.from, editor.state.doc.content.size),
        )
      : selection.$from;
    return $from.depth > 0
      ? $from.after($from.depth)
      : (savedSelection?.to ?? selection.to);
  };

  return {
    getDocument: () => getRef()?.getJSON() ?? emptyDocument,
    getEmail: async () => getRef()?.getEmail() ?? { html: "", text: "" },
    getHTML: async () => getRef()?.getEmailHTML() ?? "",
    getText: async () => getRef()?.getEmailText() ?? "",
    insertVariable: (name, fallback) => {
      const value = fallback
        ? `{{${name},fallback=${fallback}}}`
        : `{{${name}}}`;
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      restoreTextSelection(editor).insertContent(value).run();
    },
    insertUnsubscribe: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      restoreTextSelection(editor)
        .insertContent('<a href="{{usesend_unsubscribe_url}}">Unsubscribe</a>')
        .run();
    },
    insertButton: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      const position = getBlockInsertionPosition(editor);
      editor
        .chain()
        .focus()
        .insertContentAt(position, {
          type: "button",
          content: [{ type: "text", text: "Button" }],
        })
        .run();
    },
    insertDivider: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      const position = getBlockInsertionPosition(editor);
      editor
        .chain()
        .focus()
        .insertContentAt(position, {
          type: "horizontalRule",
        })
        .run();
    },
    insertLayout: (type) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      const position = getBlockInsertionPosition(editor);
      const emptyParagraph = { type: "paragraph" };
      const columnCount = {
        twoColumns: 2,
        threeColumns: 3,
        fourColumns: 4,
      }[type as "twoColumns" | "threeColumns" | "fourColumns"];
      editor
        .chain()
        .focus()
        .insertContentAt(
          position,
          type === "section"
            ? { type, content: [emptyParagraph] }
            : {
                type,
                content: Array.from({ length: columnCount }, () => ({
                  type: "columnsColumn",
                  content: [emptyParagraph],
                })),
              },
        )
        .run();
    },
    toggleBlock: (type) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      const chain = restoreTextSelection(editor) as ReturnType<
        EditorInstance["chain"]
      > & {
        toggleBulletList: () => { run: () => boolean };
        toggleOrderedList: () => { run: () => boolean };
        toggleBlockquote: () => { run: () => boolean };
      };
      if (type === "bulletList") chain.toggleBulletList().run();
      else if (type === "orderedList") chain.toggleOrderedList().run();
      else chain.toggleBlockquote().run();
    },
    selectLayoutBlock: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      const selected = getEditableBlock(editor);
      if (!selected) return;
      editor.chain().focus().setNodeSelection(selected.pos).run();
    },
    deleteSelectedBlock: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      if (!getSelectedBlockState()?.isSelected) return;
      const selected = getEditableBlock(editor);
      if (!selected) return;
      recordAction(editor);
      editor
        .chain()
        .focus()
        .deleteRange({
          from: selected.pos,
          to: selected.pos + selected.node.nodeSize,
        })
        .run();
    },
    moveSelectedBlock: (direction) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      if (!getSelectedBlockState()?.isSelected) return;
      const selected = getEditableBlock(editor);
      if (!selected) return;
      const $pos = editor.state.doc.resolve(selected.pos);
      const index = $pos.index();
      const siblingIndex = index + (direction === "up" ? -1 : 1);
      if (siblingIndex < 0 || siblingIndex >= $pos.parent.childCount) return;
      const sibling = $pos.parent.child(siblingIndex);
      const siblingPos =
        direction === "up"
          ? selected.pos - sibling.nodeSize
          : selected.pos + selected.node.nodeSize;
      recordAction(editor);
      // The upstream divider rejects replacement transactions while it has a
      // node selection, so move the selection before exchanging the siblings.
      editor.commands.setTextSelection(selected.pos);
      const tr = editor.state.tr;
      const from = Math.min(selected.pos, siblingPos);
      const to = Math.max(
        selected.pos + selected.node.nodeSize,
        siblingPos + sibling.nodeSize,
      );
      tr.replaceWith(
        from,
        to,
        direction === "up"
          ? [selected.node, sibling]
          : [sibling, selected.node],
      );
      editor.view.dispatch(tr);
      editor.commands.setNodeSelection(
        direction === "up" ? from : from + sibling.nodeSize,
      );
    },
    undo: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      const previous = actionHistory.undo.pop();
      if (previous) {
        actionHistory.redo.push(editor.getJSON());
        editor.commands.setContent(previous);
        return;
      }
      (
        editor.chain().focus() as unknown as {
          undo: () => { run: () => boolean };
        }
      )
        .undo()
        .run();
    },
    redo: () => {
      const editor = getRef()?.editor;
      if (!editor) return;
      const next = actionHistory.redo.pop();
      if (next) {
        actionHistory.undo.push(editor.getJSON());
        editor.commands.setContent(next);
        return;
      }
      (
        editor.chain().focus() as unknown as {
          redo: () => { run: () => boolean };
        }
      )
        .redo()
        .run();
    },
    setBlockType: (type) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      if (type === "paragraph") {
        restoreTextSelection(editor).setNode("paragraph").run();
        return;
      }
      const level = Number(type.slice(-1)) as 1 | 2 | 3;
      restoreTextSelection(editor).setNode("heading", { level }).run();
    },
    setTextAlignment: (alignment) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      restoreTextSelection(editor).run();
      setTextAlignment(editor, alignment);
    },
    toggleMark: (mark) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      restoreTextSelection(editor).toggleMark(mark).run();
    },
    updateSelectedLink: (href) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      recordAction(editor);
      if (!href.trim()) {
        restoreTextSelection(editor)
          .extendMarkRange("link")
          .unsetMark("link")
          .run();
        return;
      }
      restoreTextSelection(editor)
        .extendMarkRange("link")
        .setMark("link", { href: href.trim() })
        .run();
    },
    updateSelectedButton: (value) => {
      const editor = getRef()?.editor;
      if (!editor) return;
      const activeButton = getEditableButton(editor);
      if (!activeButton) return;
      recordAction(editor);

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
      const activeButton = getEditableButton(editor);
      if (!activeButton) return;
      recordAction(editor);
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
      actionHistory.undo.length = 0;
      actionHistory.redo.length = 0;
      const editor = getRef()?.editor;
      if (!editor) return;
      editor.commands.setContent(content);
    },
  };
}

export const ReactEmailEditor = forwardRef<
  ReactEmailEditorRef,
  ReactEmailEditorProps
>(function ReactEmailEditor(
  {
    bubbleMenu,
    className,
    onDocumentChange,
    onReady,
    onSelectionChange,
    ...props
  },
  forwardedRef,
) {
  const editorRef = useRef<BaseEmailEditorRef>(null);
  const textSelectionRef = useRef<TextSelectionRange | null>(null);
  const buttonPositionRef = useRef<number | null>(null);
  const blockPositionRef = useRef<number | null>(null);
  const lastFocusedStateRef = useRef<ReactEmailEditorState | null>(null);
  const actionHistoryRef = useRef<EditorActionHistory>({
    undo: [],
    redo: [],
  });
  const selectionCleanupRef = useRef<(() => void) | null>(null);
  const onDocumentChangeRef = useRef(onDocumentChange);
  const onReadyRef = useRef(onReady);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onUploadImageRef = useRef(props.onUploadImage);
  onDocumentChangeRef.current = onDocumentChange;
  onReadyRef.current = onReady;
  onSelectionChangeRef.current = onSelectionChange;
  onUploadImageRef.current = props.onUploadImage;
  const uploadImage = useCallback((file: File) => {
    const handler = onUploadImageRef.current;
    if (!handler)
      return Promise.reject(new Error("Image uploads are unavailable"));
    return handler(file);
  }, []);

  useEffect(() => () => selectionCleanupRef.current?.(), []);

  useImperativeHandle(
    forwardedRef,
    () =>
      toPublicRef(
        () => editorRef.current,
        () => textSelectionRef.current,
        () => buttonPositionRef.current,
        () => blockPositionRef.current,
        () => lastFocusedStateRef.current?.selectedBlock ?? null,
        actionHistoryRef.current,
      ),
    [],
  );

  const handleReady = useCallback((ref: BaseEmailEditorRef) => {
    editorRef.current = ref;
    lastFocusedStateRef.current = null;
    textSelectionRef.current = null;
    buttonPositionRef.current = null;
    blockPositionRef.current = null;
    selectionCleanupRef.current?.();
    const notifySelection = () => {
      if (!ref.editor) return;
      if (!ref.editor.isFocused && lastFocusedStateRef.current) return;
      const state = getEditorState(ref.editor);
      const selection = ref.editor.state.selection;
      if (ref.editor.isFocused && !state.button && !("node" in selection)) {
        textSelectionRef.current = {
          from: selection.from,
          to: selection.to,
        };
      }
      const activeButton = findActiveButton(ref.editor);
      if (activeButton) buttonPositionRef.current = activeButton.pos;
      const activeBlock = findSelectedBlock(ref.editor);
      if (activeBlock) blockPositionRef.current = activeBlock.pos;
      if (ref.editor.isFocused) lastFocusedStateRef.current = state;
      onSelectionChangeRef.current?.(state);
    };
    ref.editor?.on("selectionUpdate", notifySelection);
    ref.editor?.on("update", notifySelection);
    const editorElement = ref.editor?.view.dom;
    const selectClickedButton = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const divider = target.closest("hr.node-hr, hr.divider");
      if (divider && editorElement?.contains(divider) && ref.editor) {
        const index = Array.from(
          editorElement.querySelectorAll("hr.node-hr, hr.divider"),
        ).indexOf(divider);
        const positions: number[] = [];
        ref.editor.state.doc.descendants((node, position) => {
          if (node.type.name === "horizontalRule") positions.push(position);
        });
        const nodePosition = positions[index];
        if (nodePosition !== undefined) {
          event.preventDefault();
          ref.editor.chain().focus().setNodeSelection(nodePosition).run();
          return;
        }
      }
      const layout = target.closest(".node-section, .node-columns");
      if (
        layout &&
        target === layout &&
        editorElement?.contains(layout) &&
        ref.editor
      ) {
        const index = Array.from(
          editorElement.querySelectorAll(".node-section, .node-columns"),
        ).indexOf(layout);
        const positions: number[] = [];
        ref.editor.state.doc.descendants((node, position) => {
          if (layoutTypes.has(node.type.name)) positions.push(position);
        });
        const nodePosition = positions[index];
        if (nodePosition !== undefined) {
          event.preventDefault();
          ref.editor.chain().focus().setNodeSelection(nodePosition).run();
          return;
        }
      }
      const button = target.closest(".node-button");
      if (!button || !ref.editor) return;

      const buttonIndex = editorElement
        ? Array.from(editorElement.querySelectorAll(".node-button")).indexOf(
            button,
          )
        : -1;
      const buttonPositions: number[] = [];
      ref.editor.state.doc.descendants((node, position) => {
        if (node.type.name === "button") buttonPositions.push(position);
      });
      const buttonPosition = buttonPositions[buttonIndex];
      if (buttonPosition === undefined) return;

      event.preventDefault();
      ref.editor.chain().focus().setNodeSelection(buttonPosition).run();
    };
    editorElement?.addEventListener("pointerdown", selectClickedButton, true);
    editorElement?.addEventListener("mousedown", selectClickedButton, true);
    editorElement?.addEventListener("click", selectClickedButton, true);
    selectionCleanupRef.current = () => {
      ref.editor?.off("selectionUpdate", notifySelection);
      ref.editor?.off("update", notifySelection);
      editorElement?.removeEventListener(
        "pointerdown",
        selectClickedButton,
        true,
      );
      editorElement?.removeEventListener(
        "mousedown",
        selectClickedButton,
        true,
      );
      editorElement?.removeEventListener("click", selectClickedButton, true);
    };
    notifySelection();
    onReadyRef.current?.(
      toPublicRef(
        () => ref,
        () => textSelectionRef.current,
        () => buttonPositionRef.current,
        () => blockPositionRef.current,
        () => lastFocusedStateRef.current?.selectedBlock ?? null,
        actionHistoryRef.current,
      ),
    );
  }, []);

  const handleUpdate = useCallback((ref: BaseEmailEditorRef) => {
    editorRef.current = ref;
    onDocumentChangeRef.current?.(ref.getJSON());
  }, []);

  return (
    <BaseEmailEditor
      {...props}
      onUploadImage={props.onUploadImage ? uploadImage : undefined}
      ref={editorRef}
      bubbleMenu={bubbleMenu ?? DEFAULT_BUBBLE_MENU}
      className={`noyra-react-email-editor ${className ?? ""}`}
      onReady={handleReady}
      onUpdate={handleUpdate}
    />
  );
});
