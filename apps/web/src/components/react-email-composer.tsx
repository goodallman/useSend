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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@usesend/ui/src/tabs";
import { Textarea } from "@usesend/ui/src/textarea";
import { Code2, Eye, Variable } from "lucide-react";
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
  const [selectedVariable, setSelectedVariable] = useState(
    variables[0] ?? "email",
  );
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

  return (
    <div className="space-y-4">
      <Tabs defaultValue="visual">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="html">
              <Code2 className="mr-2 h-4 w-4" /> HTML
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" /> Preview
            </TabsTrigger>
          </TabsList>
          <div className="flex min-w-[300px] items-center gap-2">
            <Select
              value={selectedVariable}
              onValueChange={setSelectedVariable}
            >
              <SelectTrigger className="h-8">
                <Variable className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {variables.map((variable) => (
                  <SelectItem key={variable} value={variable}>
                    {`{{${variable}}}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                editorRef.current?.insertVariable(selectedVariable)
              }
            >
              Insert
            </Button>
          </div>
        </div>

        <TabsContent value="visual" className="mt-4">
          <div className="overflow-hidden rounded-lg border bg-white">
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
              className="min-h-[560px] px-8 py-10 text-slate-950 [&_.tiptap]:mx-auto [&_.tiptap]:max-w-[600px] [&_.tiptap]:outline-none"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => editorRef.current?.insertUnsubscribe()}
            >
              Insert unsubscribe link
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="html" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Advanced mode. Saving HTML keeps the visual document as a fallback
            and sends this source exactly as shown.
          </p>
          <Textarea
            value={html}
            readOnly={disabled}
            onChange={(event) => setHtml(event.target.value)}
            className="min-h-[560px] font-mono text-xs"
            spellCheck={false}
          />
          <div className="flex justify-end">
            <Button disabled={disabled} onClick={() => void saveHtmlOverride()}>
              Save HTML
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              isLoading={isExporting}
              onClick={() => void refreshOutput()}
            >
              Refresh preview
            </Button>
          </div>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={html}
            className="min-h-[560px] w-full rounded-lg border bg-white"
          />
          {text ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Plain-text version
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">
                {text}
              </pre>
            </details>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
