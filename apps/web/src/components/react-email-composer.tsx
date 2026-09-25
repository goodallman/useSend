"use client";

import {
  createReactEmailContent,
  DEFAULT_REACT_EMAIL_DOCUMENT,
  parseReactEmailContent,
  ReactEmailEditor,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@usesend/ui/src/tabs";
import { Textarea } from "@usesend/ui/src/textarea";
import {
  Braces,
  ChevronDown,
  Code2,
  Eye,
  Link2,
  Monitor,
  MousePointer2,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
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
  const parsedContent = useMemo(
    () => parseReactEmailContent(content),
    [content],
  );
  const initialDocument =
    parsedContent?.document ?? DEFAULT_REACT_EMAIL_DOCUMENT;
  const [document, setDocument] = useState<ReactEmailDocument>(initialDocument);
  const [html, setHtml] = useState(
    parsedContent?.htmlOverride ?? initialHtml ?? "",
  );
  const [text, setText] = useState("");
  const [mode, setMode] = useState<EditorMode>("visual");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [isExporting, setIsExporting] = useState(false);

  const refreshOutput = useCallback(async () => {
    if (!editorRef.current) return null;
    setIsExporting(true);
    try {
      const output = await editorRef.current.getEmail();
      setHtml(output.html);
      setText(output.text);
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
    if (nextMode === "preview") void refreshOutput();
  };

  return (
    <Tabs value={mode} onValueChange={changeMode}>
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-3 py-2 sm:px-4">
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
                        editorRef.current?.insertVariable(variable)
                      }
                    >
                      <Braces className="text-muted-foreground" />
                      <code className="text-xs">{`{{${variable}}}`}</code>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => editorRef.current?.insertUnsubscribe()}
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

        <TabsContent value="visual" className="m-0">
          <div className="bg-slate-100 p-3 dark:bg-slate-950/50 sm:p-6 lg:p-10">
            <div className="mx-auto min-h-[600px] w-full max-w-[680px] overflow-visible bg-white shadow-[0_12px_40px_rgba(15,23,42,0.10)] ring-1 ring-slate-200">
              <ReactEmailEditor
                ref={editorRef}
                content={initialDocument}
                editable={!disabled}
                onDocumentChange={handleDocumentChange}
                onReady={() => {
                  if (!html) void refreshOutput();
                }}
                onUploadImage={
                  uploadImage
                    ? async (file) => ({ url: await uploadImage(file) })
                    : undefined
                }
                className="min-h-[600px] w-full max-w-full overflow-hidden px-6 py-10 text-slate-950 sm:px-12 sm:py-14 [&_.node-container]:!w-full [&_.node-container]:!max-w-full [&_.tiptap]:mx-auto [&_.tiptap]:w-full [&_.tiptap]:max-w-[584px] [&_.tiptap]:break-words [&_.tiptap]:outline-none"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="html" className="m-0">
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
                onChange={(event) => setHtml(event.target.value)}
                className="min-h-[560px] resize-y rounded-none border-0 p-5 font-mono text-xs focus-visible:ring-0"
                spellCheck={false}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <div className="min-h-[680px] bg-slate-100 p-3 dark:bg-slate-950/50 sm:p-6 lg:p-10">
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={html}
              className={`mx-auto min-h-[600px] w-full bg-white shadow-[0_12px_40px_rgba(15,23,42,0.10)] ring-1 ring-slate-200 transition-[max-width] ${
                previewSize === "mobile" ? "max-w-[390px]" : "max-w-[680px]"
              }`}
            />
            {text ? (
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
