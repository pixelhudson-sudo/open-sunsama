"use client";

import DOMPurify from "dompurify";
import { useMemo } from "react";
import { cn, resolveUploadUrl } from "@/lib/utils";

interface HtmlContentProps {
  html: string;
  className?: string;
}

export function HtmlContent({ html, className }: HtmlContentProps) {
  const sanitizedHtml = useMemo(() => {
    if (!html) return null;
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "b", "em", "i", "u", "s", "a",
        "ul", "ol", "li", "blockquote", "pre", "code", "span", "div", "img",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class", "src", "alt", "title"],
      ADD_ATTR: ["target"],
    });
    // Uploads are stored as relative proxy paths — resolve to the API origin
    // so <img> tags actually load when rendered on the frontend domain.
    return clean.replace(
      /src="(\/uploads\/[^"]*)"/g,
      (_m, p1) => `src="${resolveUploadUrl(p1)}"`
    );
  }, [html]);

  if (!sanitizedHtml) {
    return null;
  }

  // Check for actual content
  const hasContent = sanitizedHtml.replace(/<[^>]*>/g, "").trim() !== "";

  if (!hasContent) {
    return null;
  }

  return (
    <div
      className={cn(
        // Compact text like Linear - smaller font, tighter spacing
        "prose dark:prose-invert max-w-none",
        "text-[13px] leading-relaxed",
        "prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
        "prose-a:underline prose-a:underline-offset-2",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
