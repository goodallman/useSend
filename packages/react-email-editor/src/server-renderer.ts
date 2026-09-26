import type { ReactEmailDocument } from "./react-email-editor";

type EmailDocumentNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: EmailDocumentNode[];
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function attribute(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? escapeHtml(String(value))
    : "";
}

function nodeStyle(node: EmailDocumentNode, extra = "") {
  const style = typeof node.attrs?.style === "string" ? node.attrs.style : "";
  const alignment =
    typeof node.attrs?.alignment === "string"
      ? node.attrs.alignment
      : typeof node.attrs?.textAlign === "string"
        ? node.attrs.textAlign
        : "";
  return [style, alignment ? `text-align: ${alignment};` : "", extra]
    .filter(Boolean)
    .join(" ");
}

function renderText(node: EmailDocumentNode) {
  let html = escapeHtml(node.text ?? "");
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<span style="text-decoration: underline;">${html}</span>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "link":
        html = `<a href="${attribute(mark.attrs?.href)}" style="${attribute(mark.attrs?.style)}">${html}</a>`;
        break;
    }
  }
  return html;
}

function renderNode(node: EmailDocumentNode): string {
  if (node.type === "text") return renderText(node);

  const children = (node.content ?? []).map(renderNode).join("");
  const style = attribute(nodeStyle(node));

  switch (node.type) {
    case "doc":
    case "body":
      return children;
    case "paragraph":
      return `<p style="${style}">${children || "<br>"}</p>`;
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      return `<h${level} style="${style}">${children}</h${level}>`;
    }
    case "button": {
      const alignment = attribute(node.attrs?.alignment || "left");
      const buttonStyle = attribute(
        nodeStyle(
          node,
          "display: inline-block; padding: 10px 16px; text-decoration: none;",
        ),
      );
      return `<p style="text-align: ${alignment};"><a href="${attribute(node.attrs?.href)}" style="${buttonStyle}">${children}</a></p>`;
    }
    case "horizontalRule":
    case "divider":
      return `<hr style="${style || "border: 0; border-top: 1px solid #e5e7eb;"}">`;
    case "hardBreak":
      return "<br>";
    case "image":
      return `<img src="${attribute(node.attrs?.src)}" alt="${attribute(node.attrs?.alt)}" width="${attribute(node.attrs?.width)}" height="${attribute(node.attrs?.height)}" style="${style || "max-width: 100%; height: auto;"}">`;
    case "bulletList":
      return `<ul style="${style}">${children}</ul>`;
    case "orderedList":
      return `<ol style="${style}">${children}</ol>`;
    case "listItem":
      return `<li style="${style}">${children}</li>`;
    case "blockquote":
      return `<blockquote style="${style}">${children}</blockquote>`;
    case "codeBlock":
      return `<pre style="${style}"><code>${children}</code></pre>`;
    case "table":
      return `<table role="presentation" style="${style}"><tbody>${children}</tbody></table>`;
    case "tableRow":
      return `<tr style="${style}">${children}</tr>`;
    case "tableHeader":
      return `<th style="${style}">${children}</th>`;
    case "tableCell":
      return `<td style="${style}">${children}</td>`;
    case "section":
    case "container":
    case "div":
    case "twoColumns":
    case "threeColumns":
    case "fourColumns":
    case "columnsColumn":
      return `<div style="${style}">${children}</div>`;
    default:
      return children;
  }
}

function renderPlainText(node: EmailDocumentNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";

  const children = (node.content ?? []).map(renderPlainText).join("");
  return [
    "paragraph",
    "heading",
    "button",
    "horizontalRule",
    "divider",
    "listItem",
    "blockquote",
    "codeBlock",
  ].includes(node.type ?? "")
    ? `${children}\n`
    : children;
}

export async function renderReactEmailDocument(
  document: ReactEmailDocument,
): Promise<{ html: string; text: string }> {
  const content = renderNode(document as EmailDocumentNode);
  return {
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin: 0; background: #f3f4f6;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr><td align="center" style="padding: 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background: #ffffff;"><tbody><tr><td style="padding: 32px; font-family: Arial, sans-serif; color: #111827;">${content}</td></tr></tbody></table></td></tr></tbody></table></body></html>`,
    text: renderPlainText(document as EmailDocumentNode).trim(),
  };
}
