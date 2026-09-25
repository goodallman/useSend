"use client";

import {
  createReactEmailContent,
  DEFAULT_REACT_EMAIL_DOCUMENT,
  parseReactEmailContent,
  ReactEmailEditor,
  type ReactEmailButtonState,
  type ReactEmailEditorState,
  type ReactEmailDocument,
  type ReactEmailEditorRef,
} from "@usesend/react-email-editor";
import { Button } from "@usesend/ui/src/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@usesend/ui/src/dropdown-menu";
import { Input } from "@usesend/ui/src/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@usesend/ui/src/tabs";
import { Textarea } from "@usesend/ui/src/textarea";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  ChevronDown,
  Code2,
  Eye,
  Italic,
  Link2,
  Minus,
  Monitor,
  MousePointer2,
  Plus,
  RefreshCw,
  Redo2,
  Smartphone,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

interface ReactEmailComposerProps {
  content?: string | null;
  html?: string | null;
  variables: string[];
  disabled?: boolean;
  // eslint-disable-next-line no-unused-vars
  uploadImage?: (file: File) => Promise<string>;
  // eslint-disable-next-line no-unused-vars
  onSave: (value: { content: string; html: string }) => Promise<void> | void;
  // eslint-disable-next-line no-unused-vars
  onSavingChange?: (isSaving: boolean) => void;
}

type EditorMode = "visual" | "html" | "preview";
type PreviewSize = "desktop" | "mobile";

const initialEditorState: ReactEmailEditorState = {
  blockType: "paragraph",
  alignment: "left",
  marks: { bold: false, italic: false, underline: false, strike: false },
  hasTextSelection: false,
  linkHref: "",
  button: null,
};

function patchInlineStyle(
  style: string,
  changes: Record<string, string>,
): string {
  const declarations = new Map<string, string>();
  for (const declaration of style.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator === -1) continue;
    declarations.set(
      declaration.slice(0, separator).trim(),
      declaration.slice(separator + 1).trim(),
    );
  }
  for (const [property, value] of Object.entries(changes)) {
    if (value) declarations.set(property, value);
    else declarations.delete(property);
  }
  return [...declarations]
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

function getInlineStyleValue(
  style: string,
  property: string,
  fallback: string,
) {
  for (const declaration of style.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator === -1) continue;
    if (declaration.slice(0, separator).trim() === property) {
      const value = declaration.slice(separator + 1).trim();
      const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
      if (!rgb) return /^#[\da-f]{6}$/i.test(value) ? value : fallback;
      return `#${rgb
        .slice(1)
        .map((channel) => Number(channel).toString(16).padStart(2, "0"))
        .join("")}`;
    }
  }
  return fallback;
}

export function ReactEmailComposer({
  content,
  html: initialHtml,
  variables,
  disabled,
  uploadImage,
  onSave,
  onSavingChange,
}: ReactEmailComposerProps) {
  const editorRef = useRef<ReactEmailEditorRef>(null);
  const editorHistoryRef = useRef<{
    undo: ReactEmailDocument[];
    redo: ReactEmailDocument[];
  }>({ undo: [], redo: [] });
  const parsedContent = useMemo(
    () => parseReactEmailContent(content),
    [content],
  );
  const initialDocument =
    parsedContent?.document ?? DEFAULT_REACT_EMAIL_DOCUMENT;
  const [document, setDocument] = useState<ReactEmailDocument>(initialDocument);
  const [editorContent, setEditorContent] =
    useState<ReactEmailDocument>(initialDocument);
  const [editorRevision, setEditorRevision] = useState(0);
  const [html, setHtml] = useState(
    parsedContent?.htmlOverride ?? initialHtml ?? "",
  );
  const [text, setText] = useState("");
  const [mode, setMode] = useState<EditorMode>("visual");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [isExporting, setIsExporting] = useState(false);
  const [sourceIsCustom, setSourceIsCustom] = useState(
    Boolean(parsedContent?.htmlOverride),
  );
  const [editorState, setEditorState] =
    useState<ReactEmailEditorState>(initialEditorState);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const linkPanelInteractingRef = useRef(false);
  const [selectedButton, setSelectedButton] =
    useState<ReactEmailButtonState | null>(null);

  const runEditorAction = (
    // eslint-disable-next-line no-unused-vars
    action: (editor: ReactEmailEditorRef) => void,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;
    editorHistoryRef.current.undo.push(editor.getDocument());
    if (editorHistoryRef.current.undo.length > 100) {
      editorHistoryRef.current.undo.shift();
    }
    editorHistoryRef.current.redo.length = 0;
    action(editor);
  };

  const undoEditorAction = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const previous = editorHistoryRef.current.undo.pop();
    if (!previous) {
      editor.undo();
      return;
    }
    editorHistoryRef.current.redo.push(editor.getDocument());
    editor.setContent(previous);
    setDocument(previous);
    setEditorContent(previous);
    setSelectedButton(null);
    setLinkPanelOpen(false);
    setEditorRevision((revision) => revision + 1);
  };

  const redoEditorAction = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = editorHistoryRef.current.redo.pop();
    if (!next) {
      editor.redo();
      return;
    }
    editorHistoryRef.current.undo.push(editor.getDocument());
    editor.setContent(next);
    setDocument(next);
    setEditorContent(next);
    setSelectedButton(null);
    setLinkPanelOpen(false);
    setEditorRevision((revision) => revision + 1);
  };

  useEffect(() => {
    setLinkDraft(editorState.linkHref);
  }, [editorState.hasTextSelection, editorState.linkHref]);

  const handleEditorSelectionChange = (next: ReactEmailEditorState) => {
    setEditorState(next);
    if (next.button) {
      setSelectedButton(next.button);
      setLinkPanelOpen(false);
    } else if (next.hasTextSelection) {
      setSelectedButton(null);
      setLinkPanelOpen(true);
    } else if (!linkPanelInteractingRef.current) {
      setLinkPanelOpen(false);
    }
  };

  const updateButtonStyle = (changes: Record<string, string>) => {
    if (!selectedButton) return;
    runEditorAction((editor) => {
      editor.updateSelectedButton({
        style: patchInlineStyle(selectedButton.style, changes),
      });
    });
  };

  const refreshOutput = useCallback(async () => {
    if (!editorRef.current) return null;
    setIsExporting(true);
    try {
      const output = await editorRef.current.getEmail();
      setHtml(output.html);
      setText(output.text);
      setSourceIsCustom(false);
      return output;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const saveVisual = useDebouncedCallback(async (next: ReactEmailDocument) => {
    if (!editorRef.current || disabled) return;
    onSavingChange?.(true);
    try {
      const output = await editorRef.current.getEmail();
      setHtml(output.html);
      setText(output.text);
      await onSave({
        content: JSON.stringify(createReactEmailContent(next)),
        html: output.html,
      });
    } finally {
      onSavingChange?.(false);
    }
  }, 900);

  const handleDocumentChange = (next: ReactEmailDocument) => {
    setDocument(next);
    void saveVisual(next);
  };

  const saveHtmlOverride = async () => {
    if (disabled) return;
    onSavingChange?.(true);
    try {
      await onSave({
        content: JSON.stringify(createReactEmailContent(document, html)),
        html,
      });
    } finally {
      onSavingChange?.(false);
    }
  };

  const changeMode = (value: string) => {
    const nextMode = value as EditorMode;
    setMode(nextMode);
    if (nextMode === "preview" && mode !== "html" && !sourceIsCustom) {
      void refreshOutput();
    }
  };
  const hasContextPanel =
    mode === "visual" && (linkPanelOpen || Boolean(selectedButton));

  return (
    <Tabs value={mode} onValueChange={changeMode}>
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm lg:grid lg:grid-cols-[minmax(0,1fr)_252px]">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-3 py-2 sm:px-4 lg:col-span-2">
          <TabsList aria-label="Email editor mode">
            <TabsTrigger value="visual">
              <MousePointer2 className="mr-2 h-4 w-4" /> Design
            </TabsTrigger>
            <TabsTrigger value="html">
              <Code2 className="mr-2 h-4 w-4" /> HTML
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" /> Preview
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1">
            {mode === "preview" ? (
              <>
                <div className="mr-1 flex rounded-md border bg-muted/40 p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={previewSize === "desktop" ? "secondary" : "ghost"}
                    className="h-7 px-2"
                    aria-label="Desktop preview"
                    onClick={() => setPreviewSize("desktop")}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={previewSize === "mobile" ? "secondary" : "ghost"}
                    className="h-7 px-2"
                    aria-label="Mobile preview"
                    onClick={() => setPreviewSize("mobile")}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  isLoading={isExporting}
                  aria-label="Refresh preview"
                  disabled={sourceIsCustom}
                  title={
                    sourceIsCustom
                      ? "The preview already shows your current HTML source"
                      : "Regenerate from the visual design"
                  }
                  onClick={() => void refreshOutput()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </>
            ) : null}

            {mode === "visual" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                  >
                    <Braces className="mr-2 h-4 w-4" /> Personalize
                    <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <span className="block">Insert a variable</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      It will be replaced for every recipient.
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {variables.map((variable) => (
                    <DropdownMenuItem
                      key={variable}
                      onSelect={() =>
                        runEditorAction((editor) =>
                          editor.insertVariable(variable),
                        )
                      }
                    >
                      <Braces className="text-muted-foreground" />
                      <code className="text-xs">{`{{${variable}}}`}</code>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      runEditorAction((editor) => editor.insertUnsubscribe())
                    }
                  >
                    <Link2 className="text-muted-foreground" />
                    Unsubscribe link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {mode === "html" ? (
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={() => void saveHtmlOverride()}
              >
                Save HTML
              </Button>
            ) : null}
          </div>
        </div>

        {mode === "visual" ? (
          <>
            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/20 px-3 py-2 sm:px-4 lg:col-span-2">
              <Select
                value={editorState.blockType}
                disabled={disabled || Boolean(selectedButton)}
                onValueChange={(value) =>
                  runEditorAction((editor) =>
                    editor.setBlockType(
                      value as ReactEmailEditorState["blockType"],
                    ),
                  )
                }
              >
                <SelectTrigger
                  className="mr-1 h-8 w-[132px]"
                  aria-label="Text style"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paragraph">Paragraph</SelectItem>
                  <SelectItem value="heading1">Heading 1</SelectItem>
                  <SelectItem value="heading2">Heading 2</SelectItem>
                  <SelectItem value="heading3">Heading 3</SelectItem>
                </SelectContent>
              </Select>

              {(
                [
                  ["bold", Bold, "Bold"],
                  ["italic", Italic, "Italic"],
                  ["underline", Underline, "Underline"],
                  ["strike", Strikethrough, "Strikethrough"],
                ] as const
              ).map(([mark, Icon, label]) => (
                <Button
                  key={mark}
                  type="button"
                  size="sm"
                  variant={editorState.marks[mark] ? "secondary" : "ghost"}
                  className="h-8 w-8 px-0"
                  disabled={disabled || Boolean(selectedButton)}
                  aria-label={label}
                  aria-pressed={editorState.marks[mark]}
                  title={label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    runEditorAction((editor) => editor.toggleMark(mark))
                  }
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}

              <span className="mx-1 h-5 w-px bg-border" />

              {(
                [
                  ["left", AlignLeft, "Align left"],
                  ["center", AlignCenter, "Align center"],
                  ["right", AlignRight, "Align right"],
                ] as const
              ).map(([alignment, Icon, label]) => (
                <Button
                  key={alignment}
                  type="button"
                  size="sm"
                  variant={
                    editorState.alignment === alignment ? "secondary" : "ghost"
                  }
                  className="h-8 w-8 px-0"
                  disabled={disabled || Boolean(selectedButton)}
                  aria-label={label}
                  aria-pressed={editorState.alignment === alignment}
                  title={label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    runEditorAction((editor) =>
                      editor.setTextAlignment(alignment),
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}

              <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 px-0"
                disabled={disabled}
                aria-label="Undo"
                title="Undo"
                onMouseDown={(event) => event.preventDefault()}
                onClick={undoEditorAction}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 px-0"
                disabled={disabled}
                aria-label="Redo"
                title="Redo"
                onMouseDown={(event) => event.preventDefault()}
                onClick={redoEditorAction}
              >
                <Redo2 className="h-4 w-4" />
              </Button>

              <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  runEditorAction((editor) => editor.insertButton())
                }
              >
                <Plus className="mr-1.5 h-4 w-4" /> Button
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  runEditorAction((editor) => editor.insertDivider())
                }
              >
                <Minus className="mr-1.5 h-4 w-4" /> Divider
              </Button>
            </div>

            {linkPanelOpen && !selectedButton ? (
              <div
                className="flex flex-wrap items-end gap-2 border-b bg-blue-50/70 px-3 py-3 text-slate-900 dark:bg-blue-950/20 dark:text-foreground sm:px-4 lg:col-start-2 lg:row-start-3 lg:min-h-[680px] lg:flex-col lg:items-stretch lg:border-b-0 lg:border-l lg:p-5"
                onPointerDownCapture={() => {
                  linkPanelInteractingRef.current = true;
                }}
                onFocusCapture={() => {
                  linkPanelInteractingRef.current = true;
                }}
                onBlurCapture={() => {
                  window.setTimeout(() => {
                    linkPanelInteractingRef.current = false;
                  });
                }}
              >
                <label className="min-w-[220px] flex-1 space-y-1 text-xs font-medium">
                  <span>Link for selected text</span>
                  <Input
                    value={linkDraft}
                    disabled={disabled}
                    className="h-9 bg-background"
                    placeholder="https://example.com"
                    onChange={(event) => setLinkDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        runEditorAction((editor) =>
                          editor.updateSelectedLink(linkDraft),
                        );
                        setLinkPanelOpen(false);
                      }
                    }}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  disabled={disabled || !linkDraft.trim()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    runEditorAction((editor) =>
                      editor.updateSelectedLink(linkDraft),
                    );
                    setLinkPanelOpen(false);
                  }}
                >
                  <Link2 className="mr-1.5 h-4 w-4" /> Apply link
                </Button>
                {editorState.linkHref ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      runEditorAction((editor) =>
                        editor.updateSelectedLink(""),
                      );
                      setLinkPanelOpen(false);
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ) : null}

            {selectedButton ? (
              <div
                className="border-b bg-blue-50/70 px-3 py-3 text-slate-900 dark:bg-blue-950/20 dark:text-foreground sm:px-4 lg:col-start-2 lg:row-start-3 lg:min-h-[680px] lg:border-b-0 lg:border-l lg:p-5"
              >
                <div className="mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">Button settings</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="-mr-2 h-8 w-8 shrink-0 px-0"
                      aria-label="Close button settings"
                      onClick={() => setSelectedButton(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Edit the selected button without covering the email.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <label className="space-y-1 text-xs font-medium">
                    <span>Label</span>
                    <Input
                      value={selectedButton.text}
                      disabled={disabled}
                      className="h-9 bg-background"
                      onChange={(event) =>
                        runEditorAction((editor) =>
                          editor.updateSelectedButton({
                            text: event.target.value,
                          }),
                        )
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    <span>Link URL</span>
                    <Input
                      value={selectedButton.href}
                      disabled={disabled}
                      className="h-9 bg-background"
                      placeholder="https://example.com"
                      onChange={(event) =>
                        runEditorAction((editor) =>
                          editor.updateSelectedButton({
                            href: event.target.value,
                          }),
                        )
                      }
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="block text-xs font-medium">Size</span>
                    <div className="flex h-9 rounded-md border bg-background p-0.5">
                      {(
                        [
                          ["S", "8px", "14px", "14px"],
                          ["M", "12px", "20px", "16px"],
                          ["L", "16px", "28px", "18px"],
                        ] as const
                      ).map(([label, vertical, horizontal, fontSize]) => (
                        <Button
                          key={label}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 min-w-8 px-2 text-xs"
                          disabled={disabled}
                          aria-label={`${label} button size`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            updateButtonStyle({
                              "padding-top": vertical,
                              "padding-right": horizontal,
                              "padding-bottom": vertical,
                              "padding-left": horizontal,
                              "font-size": fontSize,
                            })
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <label className="space-y-1 text-xs font-medium">
                      <span className="block">Button</span>
                      <input
                        type="color"
                        value={getInlineStyleValue(
                          selectedButton.style,
                          "background-color",
                          "#111827",
                        )}
                        disabled={disabled}
                        className="h-9 w-10 cursor-pointer rounded-md border bg-background p-1"
                        aria-label="Button color"
                        onChange={(event) =>
                          updateButtonStyle({
                            "background-color": event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      <span className="block">Text</span>
                      <input
                        type="color"
                        value={getInlineStyleValue(
                          selectedButton.style,
                          "color",
                          "#ffffff",
                        )}
                        disabled={disabled}
                        className="h-9 w-10 cursor-pointer rounded-md border bg-background p-1"
                        aria-label="Button text color"
                        onChange={(event) =>
                          updateButtonStyle({ color: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">Position</span>
                  {(
                    [
                      ["left", AlignLeft],
                      ["center", AlignCenter],
                      ["right", AlignRight],
                    ] as const
                  ).map(([alignment, Icon]) => (
                    <Button
                      key={alignment}
                      type="button"
                      size="sm"
                      variant={
                        selectedButton.alignment === alignment
                          ? "secondary"
                          : "outline"
                      }
                      className="h-8 w-8 px-0"
                      disabled={disabled}
                      aria-label={`Position button ${alignment}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        runEditorAction((editor) =>
                          editor.updateSelectedButton({ alignment }),
                        )
                      }
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-8 w-full justify-start px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      runEditorAction((editor) =>
                        editor.deleteSelectedButton(),
                      );
                      setSelectedButton(null);
                    }}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete button
                  </Button>
                </div>
              </div>
            ) : null}

            {!hasContextPanel ? (
              <div className="hidden min-h-[680px] border-l bg-muted/10 p-5 lg:col-start-2 lg:row-start-3 lg:block">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Content settings
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      Select text, a link, or a button to edit its settings here.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <TabsContent
          value="visual"
          className="m-0 min-w-0 lg:col-start-1 lg:row-start-3"
        >
          <div className="bg-slate-100 p-3 dark:bg-slate-950/50 sm:p-6 lg:py-10 lg:pl-10 lg:pr-0">
            <div className="mx-auto min-h-[600px] w-full max-w-[680px] overflow-visible bg-white shadow-[0_12px_40px_rgba(15,23,42,0.10)] ring-1 ring-slate-200">
              <ReactEmailEditor
                key={editorRevision}
                ref={editorRef}
                content={editorContent}
                editable={!disabled}
                onDocumentChange={handleDocumentChange}
                onSelectionChange={handleEditorSelectionChange}
                onReady={() => {
                  if (!html) void refreshOutput();
                }}
                onUploadImage={
                  uploadImage
                    ? async (file) => ({ url: await uploadImage(file) })
                    : undefined
                }
                className="min-h-[600px] w-full max-w-full px-6 py-10 text-slate-950 sm:px-12 sm:py-14 [&_.node-container]:!w-full [&_.node-container]:!max-w-full [&_.tiptap]:mx-auto [&_.tiptap]:w-full [&_.tiptap]:max-w-[584px] [&_.tiptap]:break-words [&_.tiptap]:outline-none"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="html" className="m-0 lg:col-span-2">
          <div className="bg-slate-100 p-3 dark:bg-slate-950/50 sm:p-6 lg:p-10">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border bg-background shadow-sm">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium">Email source</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Advanced mode sends this HTML exactly as written. Your design
                  remains available as a fallback.
                </p>
              </div>
              <Textarea
                aria-label="Email HTML source"
                value={html}
                readOnly={disabled}
                onChange={(event) => {
                  setHtml(event.target.value);
                  setSourceIsCustom(true);
                }}
                className="min-h-[560px] resize-y rounded-none border-0 p-5 font-mono text-xs focus-visible:ring-0"
                spellCheck={false}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="m-0 lg:col-span-2">
          <div className="min-h-[680px] bg-slate-100 p-3 dark:bg-slate-950/50 sm:p-6 lg:p-10">
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={html}
              className={`mx-auto min-h-[600px] w-full bg-white shadow-[0_12px_40px_rgba(15,23,42,0.10)] ring-1 ring-slate-200 transition-[max-width] ${
                previewSize === "mobile" ? "max-w-[390px]" : "max-w-[680px]"
              }`}
            />
            {text && !sourceIsCustom ? (
              <details className="mx-auto mt-4 max-w-[680px] rounded-lg border bg-background px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Plain-text version
                </summary>
                <pre className="mt-3 whitespace-pre-wrap border-t pt-3 text-xs text-muted-foreground">
                  {text}
                </pre>
              </details>
            ) : null}
          </div>
        </TabsContent>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {mode === "visual" ? (
              <>
                Type{" "}
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  /
                </kbd>{" "}
                to add headings, buttons, images, and layouts.
              </>
            ) : mode === "html" ? (
              "HTML changes are saved only when you choose Save HTML."
            ) : (
              `${previewSize === "mobile" ? "Mobile" : "Desktop"} email preview`
            )}
          </span>
          <span>
            {disabled ? "Read only" : "Design changes save automatically"}
          </span>
        </div>
      </div>
    </Tabs>
  );
}
