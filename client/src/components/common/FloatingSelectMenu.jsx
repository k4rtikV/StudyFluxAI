import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

const VIEWPORT_MARGIN = 12;
const MENU_GAP = 8;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function FloatingSelectMenu({
  anchorRef,
  panelRef,
  children,
  maxHeight = 288,
  className = "",
}) {
  const [placement, setPlacement] =
    useState(null);

  const updatePlacement = useCallback(() => {
    const anchor = anchorRef.current;

    if (!anchor || typeof window === "undefined") {
      return;
    }

    const rect =
      anchor.getBoundingClientRect();
    const viewportWidth =
      window.innerWidth;
    const viewportHeight =
      window.innerHeight;

    const availableBelow =
      viewportHeight -
      rect.bottom -
      MENU_GAP -
      VIEWPORT_MARGIN;
    const availableAbove =
      rect.top -
      MENU_GAP -
      VIEWPORT_MARGIN;

    const shouldOpenUp =
      availableBelow <
        Math.min(maxHeight, 220) &&
      availableAbove > availableBelow;

    const availableHeight = Math.max(
      0,
      Math.min(
        maxHeight,
        shouldOpenUp
          ? availableAbove
          : availableBelow,
      ),
    );

    const maxUsableWidth = Math.max(
      0,
      viewportWidth -
        VIEWPORT_MARGIN * 2,
    );
    const width = Math.min(
      rect.width,
      maxUsableWidth,
    );
    const left = clamp(
      rect.left,
      VIEWPORT_MARGIN,
      Math.max(
        VIEWPORT_MARGIN,
        viewportWidth -
          VIEWPORT_MARGIN -
          width,
      ),
    );

    setPlacement({
      left,
      width,
      maxHeight: availableHeight,
      ...(shouldOpenUp
        ? {
            bottom:
              viewportHeight -
              rect.top +
              MENU_GAP,
            top: "auto",
          }
        : {
            top:
              rect.bottom +
              MENU_GAP,
            bottom: "auto",
          }),
    });
  }, [anchorRef, maxHeight]);

  useLayoutEffect(() => {
    updatePlacement();
  }, [updatePlacement]);

  useEffect(() => {
    const anchor = anchorRef.current;

    const handleViewportChange = () => {
      updatePlacement();
    };

    window.addEventListener(
      "resize",
      handleViewportChange,
    );
    window.addEventListener(
      "scroll",
      handleViewportChange,
      true,
    );

    const resizeObserver =
      typeof ResizeObserver !== "undefined" &&
      anchor
        ? new ResizeObserver(
            handleViewportChange,
          )
        : null;

    resizeObserver?.observe(anchor);

    return () => {
      window.removeEventListener(
        "resize",
        handleViewportChange,
      );
      window.removeEventListener(
        "scroll",
        handleViewportChange,
        true,
      );
      resizeObserver?.disconnect();
    };
  }, [anchorRef, updatePlacement]);

  if (
    typeof document === "undefined" ||
    !placement
  ) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: placement.left,
        top: placement.top,
        bottom: placement.bottom,
        width: placement.width,
        maxHeight: placement.maxHeight,
        zIndex: 10000,
      }}
      className={`sf-scrollbar overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_24px_64px_rgba(15,23,42,0.20)] ring-1 ring-slate-100 ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

export default FloatingSelectMenu;
