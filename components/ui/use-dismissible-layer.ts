"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";

export function useDismissibleLayer({
  open,
  setOpen,
  triggerRef,
  layerRef,
  focusFirst = true,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  triggerRef: RefObject<HTMLElement | null>;
  layerRef: RefObject<HTMLElement | null>;
  focusFirst?: boolean;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    if (focusFirst) {
      layerRef.current?.querySelector<HTMLElement>("a, button, input, select, textarea")?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!layerRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [focusFirst, layerRef, open, setOpen, triggerRef]);
}
