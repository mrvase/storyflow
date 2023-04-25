/** @module @lexical/plain-text */
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isNodeSelection,
  $isRootNode,
  $isTextNode,
  $setSelection,
  COPY_COMMAND,
  FORMAT_TEXT_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  LexicalEditor,
  PASTE_COMMAND,
  RangeSelection,
} from "lexical";

import {
  $moveCharacter,
  $shouldOverrideDefaultCharacterSelection,
} from "@lexical/selection";

import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  REMOVE_TEXT_COMMAND,
} from "lexical";

import { CAN_USE_BEFORE_INPUT, IS_IOS, IS_SAFARI } from "./utils/environment";
import { mergeRegister } from "./utils/mergeRegister";
import { LibraryConfig } from "@storyflow/shared/types";

/**
 * Tre scenarier for tekst
 * - ændre selection og kalde insertText("")
 * - bare kalde insertText(text)
 * - indsæt linjeskift
 */

export function registerPlainText(
  editor: LexicalEditor,
  libraries: LibraryConfig[],
  options: { allowLineBreaks?: boolean } = {}
): () => void {
  const removeListener = mergeRegister(
    // CALLS insertText("")

    editor.registerCommand<boolean>(
      DELETE_CHARACTER_COMMAND,
      (isBackward) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        // changes selection (if collapsed) -> calls removeText() --> calls insertText("")
        selection.deleteCharacter(isBackward);

        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<boolean>(
      DELETE_WORD_COMMAND,
      (isBackward) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        // changes selection -> calls removeText() --> calls insertText("")
        selection.deleteWord(isBackward);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<boolean>(
      DELETE_LINE_COMMAND,
      (isBackward) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        // changes selection -> calls removeText() --> calls insertText("")
        selection.deleteLine(isBackward);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand(
      REMOVE_TEXT_COMMAND,
      () => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        // calls insertText("")
        selection.removeText();
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),

    // CALLS formatText

    editor.registerCommand(
      FORMAT_TEXT_COMMAND,
      (format) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }
        // we block attempts to mark elements as bold right now
        // (even inline ones), as it is not yet supported.
        const nodes = selection.getNodes();
        if (nodes.some((el) => !$isTextNode(el))) {
          return false;
        }
        selection.formatText(format);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),

    // CALLS insertText(text)

    editor.registerCommand<InputEvent | string>(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      (eventOrText) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        if (typeof eventOrText === "string") {
          selection.insertText(eventOrText);
        } else {
          const dataTransfer = eventOrText.dataTransfer;

          if (dataTransfer != null) {
            const text = dataTransfer.getData("text/plain");

            if (text != null) {
              selection.insertRawText(text);
            }
          } else {
            const data = eventOrText.data;

            if (data) {
              selection.insertText(data);
            }
          }
        }

        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),

    // CALLS insertLineBreak

    ...(options.allowLineBreaks
      ? [
          editor.registerCommand<boolean>(
            INSERT_LINE_BREAK_COMMAND,
            (selectStart) => {
              const selection = $getSelection();

              if (!$isRangeSelection(selection)) {
                return false;
              }

              selection.insertLineBreak(selectStart);
              return true;
            },
            COMMAND_PRIORITY_EDITOR
          ),
          editor.registerCommand(
            INSERT_PARAGRAPH_COMMAND,
            () => {
              const selection = $getSelection();

              if (!$isRangeSelection(selection)) {
                return false;
              }

              selection.insertParagraph();
              return true;
            },
            COMMAND_PRIORITY_EDITOR
          ),
        ]
      : []),

    // MOVES SELECTION WHEN DECORATOR IS SELECTED

    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_LEFT_COMMAND,
      (event) => {
        const selection = $getSelection();

        if ($isNodeSelection(selection)) {
          // If selection is on a node, let's try and move selection
          // back to being a range selection.
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            event.preventDefault();
            nodes[0].selectPrevious();
            return true;
          }
        }
        if (!$isRangeSelection(selection)) {
          return false;
        }

        if ($shouldOverrideDefaultCharacterSelection(selection, true)) {
          const isHoldingShift = event.shiftKey;
          event.preventDefault();
          $moveCharacter(selection, isHoldingShift, true);
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_RIGHT_COMMAND,
      (event) => {
        const selection = $getSelection();

        if ($isNodeSelection(selection)) {
          // If selection is on a node, let's try and move selection
          // back to being a range selection.
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            event.preventDefault();
            nodes[0].selectNext(0, 0);
            return true;
          }
        }

        if (!$isRangeSelection(selection)) {
          return false;
        }

        if ($shouldOverrideDefaultCharacterSelection(selection, false)) {
          const isHoldingShift = event.shiftKey;
          event.preventDefault();
          $moveCharacter(selection, isHoldingShift, false);
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_EDITOR
    ),

    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_DOWN_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          // If selection is on a node, let's try and move selection
          // back to being a range selection.
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            nodes[0].selectNext(0, 0);
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR
    ),

    editor.registerCommand<KeyboardEvent>(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          // If selection is on a node, let's try and move selection
          // back to being a range selection.
          const nodes = selection.getNodes();
          if (nodes.length > 0) {
            nodes[0].selectPrevious();
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR
    ),

    // DISPATCHES

    editor.registerCommand<KeyboardEvent>(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        event.preventDefault();
        return editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_DELETE_COMMAND,
      (event) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        event.preventDefault();
        return editor.dispatchCommand(DELETE_CHARACTER_COMMAND, false);
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<KeyboardEvent | null>(
      KEY_ENTER_COMMAND,
      (event) => {
        try {
          const selection = $getSelection();

          let resolved: boolean = false;

          if ($isNodeSelection(selection)) {
            const nodes = selection.getNodes();
            if (nodes.length) {
              const last = nodes[nodes.length - 1];
              const node = $createParagraphNode();
              const textNode = $createTextNode();
              node.append(textNode);
              if (event?.shiftKey) {
                last.insertBefore(node, false);
                node.select();
              } else {
                last.insertAfter(node, false);
                node.select();
              }
              resolved = true;
            }
          } else if (!$isRangeSelection(selection)) {
            return false;
          }

          if (event !== null) {
            // If we have beforeinput, then we can avoid blocking
            // the default behavior. This ensures that the iOS can
            // intercept that we're actually inserting a paragraph,
            // and autocomplete, autocapitalize etc work as intended.
            // This can also cause a strange performance issue in
            // Safari, where there is a noticeable pause due to
            // preventing the key down of enter.
            if ((IS_IOS || IS_SAFARI) && CAN_USE_BEFORE_INPUT) {
              return false;
            }

            event.preventDefault();
          }

          if (resolved) {
            return true;
          }

          return editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
        } catch (err) {
          console.error(err);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR
    )
  );
  return removeListener;
}
