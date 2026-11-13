"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

type Props = React.ComponentProps<typeof NextLink>;

/**
 * Link that does NOT prefetch automatically. Next's default prefetches every link in the
 * viewport, and every page here is dynamic, so a page with many links fired dozens of
 * server renders (each with database queries) on load. We prefetch on hover/focus
 * instead: a desktop pointer signals intent ~100-300ms before the click.
 */
export default function Link({ prefetch, onMouseEnter, onFocus, href, ...rest }: Props) {
  const router = useRouter();
  const warm = () => {
    if (typeof href === "string" && href.startsWith("/")) router.prefetch(href);
  };
  return (
    <NextLink
      href={href}
      prefetch={prefetch ?? false}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      {...rest}
    />
  );
}
