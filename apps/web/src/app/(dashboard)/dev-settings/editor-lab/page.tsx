"use client";

import {
  ReactEmailEditor,
  type ReactEmailDocument,
  type ReactEmailEditorRef,
} from "@usesend/react-email-editor";
import { Button } from "@usesend/ui/src/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@usesend/ui/src/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@usesend/ui/src/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@usesend/ui/src/tabs";
import { Textarea } from "@usesend/ui/src/textarea";
import { Code2, Eye, Save, Variable } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const storageKey = "usesend-react-email-editor-lab-v1";

const variables = [
  "firstName",
  "lastName",
  "email",
  "companyName",
  "usesend_unsubscribe_url",
] as const;

const starterDocument: ReactEmailDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "A better email starts here" }],
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
          text: "Build responsive campaigns visually, then inspect or customize the production HTML before sending.",
        },
      ],
    },
    {
      type: "button",
      attrs: {
        href: "https://usesend.email",
        style:
          "background-color: #111827; color: #ffffff; border-radius: 8px; padding: 12px 20px;",
      },
      content: [{ type: "text", text: "Explore useSend" }],
    },
    { type: "horizontalRule" },
    {
      type: "paragraph",
      attrs: {
        style: "text-align: center; color: #6b7280; font-size: 12px;",
      },
      content: [
        {
          type: "text",
          text: "Unsubscribe",
          marks: [
            {
              type: "link",
              attrs: { href: "{{usesend_unsubscribe_url}}" },
            },
          ],
        },
      ],
    },
  ],
};

export default function EmailEditorLabPage() {
  const editorRef = useRef<ReactEmailEditorRef>(null);
  const [document, setDocument] = useState<ReactEmailDocument>(starterDocument);
  const [selectedVariable, setSelectedVariable] = useState<string>(
    variables[0],
  );
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState<string>();
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      setDocument(JSON.parse(saved) as ReactEmailDocument);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  const refreshExport = useCallback(async () => {
    if (!editorRef.current) return;
    setIsExporting(true);
    try {
      const email = await editorRef.current.getEmail();
      setHtml(email.html);
      setText(email.text);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const saveDraft = () => {
    const current = editorRef.current?.getDocument() ?? document;
    window.localStorage.setItem(storageKey, JSON.stringify(current));
    setDocument(current);
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            React Email editor lab
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A safe workspace for the next editor format. Drafts stay in this
            browser and do not change existing campaigns or templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt ? (
            <span className="text-xs text-muted-foreground">
              Saved at {savedAt}
            </span>
          ) : null}
          <Button variant="outline" onClick={saveDraft}>
            <Save className="mr-2 h-4 w-4" />
            Save draft
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Visual editor</CardTitle>
            <CardDescription>
              Type <code>/</code> for sections, columns, buttons, dividers, and
              rich content. Select text to format it.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ReactEmailEditor
              ref={editorRef}
              content={document}
              onDocumentChange={setDocument}
              onReady={() => void refreshExport()}
              className="min-h-[560px] bg-white px-10 py-12 text-slate-950 [&_.tiptap]:mx-auto [&_.tiptap]:max-w-[640px] [&_.tiptap]:outline-none"
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Variable className="h-4 w-4" /> Variables
              </CardTitle>
              <CardDescription>
                Insert a contact or system value at the current cursor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={selectedVariable}
                onValueChange={setSelectedVariable}
              >
                <SelectTrigger>
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
                className="w-full"
                onClick={() =>
                  editorRef.current?.insertVariable(selectedVariable)
                }
              >
                Insert variable
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => editorRef.current?.insertUnsubscribe()}
              >
                Insert unsubscribe link
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Format boundary</CardTitle>
              <CardDescription>
                This lab stores versioned editor JSON separately from legacy
                TipTap content. No database migration is required yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-[11px]">
                {JSON.stringify(
                  { version: 1, editor: "react-email", document },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Production output</CardTitle>
            <CardDescription>
              Compare generated HTML, plain text, and a sandboxed email preview.
            </CardDescription>
          </div>
          <Button onClick={() => void refreshExport()} isLoading={isExporting}>
            Refresh output
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">
                <Eye className="mr-2 h-4 w-4" /> Preview
              </TabsTrigger>
              <TabsTrigger value="html">
                <Code2 className="mr-2 h-4 w-4" /> HTML
              </TabsTrigger>
              <TabsTrigger value="text">Plain text</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <iframe
                title="Rendered email preview"
                sandbox=""
                srcDoc={html}
                className="mt-3 min-h-[520px] w-full rounded-md border bg-white"
              />
            </TabsContent>
            <TabsContent value="html">
              <Textarea
                aria-label="Generated email HTML"
                value={html}
                onChange={(event) => setHtml(event.target.value)}
                className="mt-3 min-h-[520px] font-mono text-xs"
                spellCheck={false}
              />
            </TabsContent>
            <TabsContent value="text">
              <Textarea
                aria-label="Generated plain text email"
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="mt-3 min-h-72 font-mono text-xs"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
