import { DocumentId, TokenStream } from "@storyflow/backend/types";
import {
  CalculatorIcon,
  CalendarIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { SWRClient } from "../../client";
import { Option as OptionComponent } from "./Option";
import { markMatchingString } from "./helpers";
import { parseDateFromString } from "../../utils/dates";
import { DEFAULT_FIELDS } from "@storyflow/backend/fields";
import { createTemplateFieldId, getDocumentId } from "@storyflow/backend/ids";
import { calculateFromRecord } from "@storyflow/backend/calculate";
import { useDocumentIdGenerator } from "../../id-generator";
import { createComponent } from "../Editor/createComponent";
import { useFieldId } from "../FieldIdContext";

export function QueryCommands({
  query,
  selected,
  insertBlock,
}: {
  query: string;
  selected: number;
  insertBlock: (comp: TokenStream) => void;
}) {
  const searchQuery = query.match(/\"([^\"]*)/)?.[1] ?? query;

  const [isSearching, setIsSearching] = React.useState(false);

  const { data } = SWRClient.documents.getByLabel.useQuery(searchQuery, {
    inactive: !isSearching,
  });

  let options: any[] = [];

  const onSearchEnter = React.useCallback(() => setIsSearching(true), []);

  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const onAIEnter = React.useCallback(() => {
    insertBlock([
      {
        id: generateDocumentId(documentId),
        text: "",
      },
    ]);
  }, [insertBlock, generateDocumentId]);

  const onEnter = React.useCallback(
    (id: DocumentId) => {
      insertBlock([{ id }]);
    },
    [insertBlock]
  );

  const date = React.useMemo(() => {
    return parseDateFromString(searchQuery);
  }, [searchQuery]);

  if (!isSearching) {
    options = [
      {
        id: 0,
        label: (
          <div className="flex items-center">
            {markMatchingString("Søg efter dokument", query)}
            {/*<EllipsisHorizontalIcon className="w-4 h-4 opacity-75" />*/}
          </div>
        ),
        /*
        secondary: `"${searchQuery.substring(0, 20)}${
          searchQuery.length > 20 ? " ..." : ""
        }"`,
        */
        onEnter: onSearchEnter,
        onEnterLabel: "Slå op",
        Icon: MagnifyingGlassIcon,
      },
      {
        id: 1,
        label: (
          <div className="flex items-center">
            {markMatchingString("AI-kommando", query)}
          </div>
        ),
        onEnter: onAIEnter,
        onEnterLabel: "Slå op",
        Icon: RocketLaunchIcon,
        /*
        secondary: `"${searchQuery.substring(0, 20)}${
          searchQuery.length > 20 ? " ..." : ""
        }"`,
        */
      },
      {
        id: 2,
        label: <div className="flex items-center">Indsæt dato</div>,
        secondary: Intl.DateTimeFormat("da-DK", {
          dateStyle: "long",
          ...([date.getHours(), date.getMinutes(), date.getSeconds()].some(
            Boolean
          )
            ? { timeStyle: "short" }
            : {}),
        }).format(date),
        onEnter: onAIEnter,
        onEnterLabel: "Indsæt",
        Icon: CalendarIcon,
      },
      {
        id: 3,
        label: (
          <div className="flex items-center">
            {markMatchingString("Skift mellem matematik/tekst", query)}
          </div>
        ),
        onEnter: onAIEnter,
        onEnterLabel: "Skift",
        Icon: CalculatorIcon,
      },
    ];
  } else {
    options = (data ?? []).map((el) => ({
      id: el._id,
      label:
        calculateFromRecord(
          createTemplateFieldId(el._id, DEFAULT_FIELDS.label.id),
          el.record
        )?.[0] ?? "",
      secondary: el._id,
      Icon: DocumentIcon,
      onEnter,
      onEnterLabel: "Tilføj",
      onArrowRight() {},
      onArrowRightLabel: "Se felter",
    }));
  }

  const current = selected < 0 ? selected : selected % options.length;

  return (
    <>
      {options.map((el, index) => (
        <OptionComponent
          key={el.id}
          value={el.id}
          onEnter={el.onEnter}
          onEnterLabel={el.onEnterLabel}
          onArrowRight={el.onArrowRight}
          onArrowRightLabel={el.onArrowRightLabel}
          isSelected={index === current}
          secondaryText={el.secondary}
          Icon={el.Icon}
        >
          {el.label}
        </OptionComponent>
      ))}
    </>
  );
}
