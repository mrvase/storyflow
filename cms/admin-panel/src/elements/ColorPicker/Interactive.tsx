import React from "react";
import { useEventCallback } from "./utils";
import { clamp } from "./utils";

export interface Interaction {
  left: number;
  top: number;
}

// Check if an event was triggered by touch
const isTouch = (event: MouseEvent | TouchEvent): event is TouchEvent =>
  "touches" in event;

// Finds a proper touch point by its identifier
const getTouchPoint = (touches: TouchList, touchId: null | number): Touch => {
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === touchId) return touches[i];
  }
  return touches[0];
};

// Finds the proper window object to fix iframe embedding issues
const getParentWindow = (node?: HTMLDivElement | null): Window => {
  return (node && node.ownerDocument.defaultView) || self;
};

// Returns a relative position of the pointer inside the node's bounding box
const getRelativePosition = (
  node: HTMLDivElement,
  event: MouseEvent | TouchEvent,
  touchId: null | number
): Interaction => {
  const rect = node.getBoundingClientRect();

  // Get user's pointer position from `touches` array if it's a `TouchEvent`
  const pointer = isTouch(event)
    ? getTouchPoint(event.touches, touchId)
    : (event as MouseEvent);

  return {
    left: clamp(
      (pointer.pageX - (rect.left + getParentWindow(node).pageXOffset)) /
        rect.width
    ),
    top: clamp(
      (pointer.pageY - (rect.top + getParentWindow(node).pageYOffset)) /
        rect.height
    ),
  };
};

// Browsers introduced an intervention, making touch events passive by default.
// This workaround removes `preventDefault` call from the touch handlers.
// https://github.com/facebook/react/issues/19651
const preventDefaultMove = (event: MouseEvent | TouchEvent): void => {
  event.preventDefault();
};

// Prevent mobile browsers from handling mouse events (conflicting with touch ones).
// If we detected a touch interaction before, we prefer reacting to touch events only.
const isInvalid = (
  event: MouseEvent | TouchEvent,
  hasTouch: boolean
): boolean => {
  return hasTouch && !isTouch(event);
};

interface Props {
  onMove: (interaction: Interaction) => void;
  onMoveEnd: (interaction: Interaction) => void;
  onKey: (offset: Interaction) => void;
  children: React.ReactNode;
}

const InteractiveBase = ({ onMove, onKey, onMoveEnd, ...rest }: Props) => {
  const container = React.useRef<HTMLDivElement>(null);
  const onMoveCallback = useEventCallback<Interaction>(onMove);
  const onMoveEndCallback = useEventCallback<Interaction>(onMoveEnd);
  const onKeyCallback = useEventCallback<Interaction>(onKey);
  const touchId = React.useRef<null | number>(null);
  const hasTouch = React.useRef(false);

  const [handleMoveStart, toggleDocumentEvents] = React.useMemo(() => {
    const handleMoveStart = (ev: React.MouseEvent | React.TouchEvent) => {
      ev.stopPropagation();
      ev.preventDefault();

      const el = container.current;
      if (!el) return;

      const { nativeEvent } = ev;

      if (isInvalid(nativeEvent, hasTouch.current) || !el) return;

      if (isTouch(nativeEvent)) {
        hasTouch.current = true;
        const changedTouches = nativeEvent.changedTouches || [];
        if (changedTouches.length)
          touchId.current = changedTouches[0].identifier;
      }

      onMoveCallback(getRelativePosition(el, nativeEvent, touchId.current));
      toggleDocumentEvents(true);
    };

    const handleMove = (event: MouseEvent | TouchEvent) => {
      // Prevent text selection
      preventDefaultMove(event);

      // If user moves the pointer outside of the window or iframe bounds and release it there,
      // `mouseup`/`touchend` won't be fired. In order to stop the picker from following the cursor
      // after the user has moved the mouse/finger back to the document, we check `event.buttons`
      // and `event.touches`. It allows us to detect that the user is just moving his pointer
      // without pressing it down
      const isDown = isTouch(event)
        ? event.touches.length > 0
        : event.buttons > 0;

      let func: (interaction: Interaction) => void;

      if (isDown) {
        func = onMoveCallback;
      } else {
        func = onMoveEndCallback;
        toggleDocumentEvents(false);
      }
      if (func && container.current) {
        func(getRelativePosition(container.current, event, touchId.current));
      }
    };

    const handleMoveEnd = (event: MouseEvent | TouchEvent) => {
      toggleDocumentEvents(false);

      const el = container.current;
      if (!el) return;

      onMoveEndCallback(getRelativePosition(el, event, touchId.current));
    };
    /*
      const handleKeyDown = (event: React.KeyboardEvent) => {
        const keyCode = event.which || event.keyCode;

        // Ignore all keys except arrow ones
        if (keyCode < 37 || keyCode > 40) return;
        // Do not scroll page by arrow keys when document is focused on the element
        event.preventDefault();
        // Send relative offset to the parent component.
        // We use codes (37←, 38↑, 39→, 40↓) instead of keys ('ArrowRight', 'ArrowDown', etc)
        // to reduce the size of the library
        onKeyCallback({
          left: keyCode === 39 ? 0.05 : keyCode === 37 ? -0.05 : 0,
          top: keyCode === 40 ? 0.05 : keyCode === 38 ? -0.05 : 0,
        });
      };
      */

    function toggleDocumentEvents(state?: boolean) {
      const touch = hasTouch.current;
      const el = container.current;
      const parentWindow = getParentWindow(el);

      // Add or remove additional pointer event listeners
      const toggleEvent = state
        ? parentWindow.addEventListener
        : parentWindow.removeEventListener;

      toggleEvent(touch ? "touchmove" : "mousemove", handleMove);
      toggleEvent(touch ? "touchend" : "mouseup", handleMoveEnd);
    }

    return [handleMoveStart, toggleDocumentEvents];
  }, [onKeyCallback, onMoveCallback]);

  // Remove window event listeners before unmounting
  React.useEffect(() => toggleDocumentEvents, [toggleDocumentEvents]);

  return (
    <div
      {...rest}
      role="slider"
      ref={container}
      className="absolute z-20 inset-0 outline-none touch-none"
      onMouseDown={handleMoveStart}
      onTouchStart={handleMoveStart}
      // onKeyDown={handleKeyDown}
    />
  );
};

export const Interactive = React.memo(InteractiveBase);
