import cl from "clsx";
import { Option } from "./Option";
import {
  Bars3BottomLeftIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { Spinner } from "../../elements/Spinner";
import { TokenStream } from "../../operations/types";
import PromptNode from "../Editor/decorators/PromptNode";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { useCompletion } from "../../utils/useCompletion";
import { useFieldId } from "../FieldIdContext";
import { ClientSyntaxTree, ValueArray } from "@storyflow/shared/types";
import { useGlobalState } from "../../state/state";
import {
  $getComputation,
  $getStartIndexFromNodeKey,
} from "../Editor/transforms";
import { SyntaxTree } from "@storyflow/cms/types";
import { createTokenStream } from "../../operations/parse-token-stream";
import { tools } from "../../operations/stream-methods";
import { $getRoot, LexicalEditor } from "lexical";
import { getUpdatedValueRecord } from "../../documents";
import { getDocumentId } from "@storyflow/cms/ids";

const toText = (stream: TokenStream) => {
  return stream.filter((el) => typeof el === "string").join("\n\n");
};

export function AIPrompt({
  prompt,
  stream,
  replacePromptWithStream,
  generatorId,
  node,
}: {
  prompt: string;
  stream: TokenStream;
  replacePromptWithStream: (stream: TokenStream) => void;
  generatorId: string;
  node: PromptNode;
}) {
  const { complete, completion, isLoading } = useCompletion({
    id: generatorId,
  });

  const id = useFieldId();
  const [tree] = useGlobalState<SyntaxTree>(`${id}#tree`);

  const editor = useEditorContext();

  React.useEffect(() => {
    editor.update(() => {
      node.setIsGenerating(isLoading);
    });
  }, [isLoading]);

  const generate = React.useCallback(async () => {
    const streamBefore = editor
      .getEditorState()
      .read(() => $getComputation($getRoot(), node.getKey()));
    console.log("STREAM BEFORE", streamBefore);
    const fullStream = tree ? createTokenStream(tree) : [];

    const streamAfter = tools.slice(
      fullStream,
      tools.getLength(streamBefore) + tools.getLength(stream)
    );

    const record = await getUpdatedValueRecord(getDocumentId(id));

    console.log("RECORD", record);

    record[id].value = ["<edited field>"];
    let documentContext = Object.values(record).map(({ label, value }) => ({
      label,
      value: toText(value),
    }));

    const json = {
      prompt,
      contextBefore: toText(streamBefore),
      contextAfter: toText(streamAfter),
      documentContext,
      selection: stream.filter((el) => typeof el === "string").join("\n\n"),
    };
    await complete(JSON.stringify(json));
  }, [editor, tree, complete, prompt, stream]);

  const insert = React.useCallback(
    (completion: string) => {
      replacePromptWithStream([completion]);
    },
    [replacePromptWithStream]
  );

  const Icon = isLoading ? Spinner : RocketLaunchIcon;

  return (
    <div className={cl("p-2.5")}>
      <div className="font-medium text-gray-400 mb-1 ml-1">AI</div>
      <Option value="" onEnter={generate} Icon={Icon}>
        Generer tekst: {prompt}
      </Option>
      {completion && (
        <Option value={completion} onEnter={insert} Icon={Bars3BottomLeftIcon}>
          {completion}
        </Option>
      )}
    </div>
  );
}
