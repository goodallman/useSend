"use client";

import {
  createReactEmailContent,
  type ReactEmailDocument,
} from "@usesend/react-email-editor";
import { Badge } from "@usesend/ui/src/badge";
import { Check, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";

import { ReactEmailComposer } from "~/components/react-email-composer";

const storageKey = "usesend-react-email-editor-lab-v1";

const variables = [
  "firstName",
  "lastName",
  "email",
  "companyName",
  "usesend_unsubscribe_url",
];

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
          "background-color: #111827; color: #ffffff; border-radius: 8px;",
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

const starterContent = JSON.stringify(createReactEmailContent(starterDocument));

export default function EmailEditorLabPage() {
  const [content, setContent] = useState(starterContent);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>();

  useEffect(() => {
    setContent(window.localStorage.getItem(storageKey) ?? starterContent);
    setIsReady(true);
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 font-normal">
              <FlaskConical className="h-3.5 w-3.5" /> Editor preview
            </Badge>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Create an email
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Design visually, personalize with contact data, edit the source, and
            check desktop or mobile output without leaving the workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isSaving ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />{" "}
              Saving locally…
            </>
          ) : savedAt ? (
            <>
              <Check className="h-4 w-4 text-emerald-500" /> Saved {savedAt}
            </>
          ) : (
            "Drafts stay in this browser"
          )}
        </div>
      </div>

      {isReady ? (
        <ReactEmailComposer
          content={content}
          variables={variables}
          onSavingChange={setIsSaving}
          onSave={({ content: nextContent }) => {
            window.localStorage.setItem(storageKey, nextContent);
            setContent(nextContent);
            setSavedAt(
              new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            );
          }}
        />
      ) : (
        <div className="h-[720px] animate-pulse rounded-xl border bg-muted/40" />
      )}
    </div>
  );
}
