"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy. Select and copy it manually.");
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}

export function ShareButton({ url, title }: { url: string; title: string }) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title, text: `Join my Daily League: ${title}`, url });
          } catch {
            /* cancelled */
          }
        } else {
          await navigator.clipboard.writeText(url).catch(() => {});
          toast.success("Invite link copied");
        }
      }}
    >
      <Share2 /> Share invite
    </Button>
  );
}
