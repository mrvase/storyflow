import { Narrow, Operators } from "./types";
import {
  ComputationBlock,
  DBDocument,
  FieldId,
  FlatComputation,
  Value,
} from "@storyflow/backend/types";
import { calculate } from "./calculate";
import { operators } from "./mongo-operators";

export type Update = ComputationBlock & {
  result: Value[];
  imports: string[];
  depth: number;
  _imports: (ComputationBlock & { depth: number })[];
};

const queryArrayProp = <T extends Array<object>>(
  doc: T
): T extends Array<infer Element>
  ? {
      [Key in keyof Element]: Element[Key] extends any[]
        ? Element[Key]
        : Element[Key][];
    }
  : T => {
  return doc as any;
};

const createCalculationStage = (
  $: Operators<
    DBDocument & {
      updates: Update[];
      derivatives: Update[];
      statics: ComputationBlock[];
    }
  >,
  updates: Update[],
  derivatives: Update[]
) => {
  return $.useDocument(($doc) => [
    {
      $set: {
        updates: $.filter(updates, (update) =>
          $.in(update.id, queryArrayProp($doc.compute).id)
        ),
        derivatives,
        statics: $.filter(
          $.map(
            $.objectToArray($doc.values),
            (el) =>
              ({
                id: $.concat($doc.id, el.k) as FieldId,
                result: el.v as FlatComputation,
              } as any)
          ),
          (el) => $.not($.in(el.id, queryArrayProp($doc.compute).id))
        ),
      },
    },
    {
      $set: {
        compute: $.define()
          .let({ size: $.size($doc.compute) })
          .return(({ size }) =>
            $.map($.range(0, size), (index) =>
              $.mergeObjects($.at($doc.compute, index), {
                depth: $.subtract([size, index]),
              })
            )
          ),
      },
    },
    {
      $set: {
        compute: $.filter($doc.compute, (compute) =>
          $.not(
            $.in(
              compute.id,
              updates.map((el) => el.id)
            )
          )
        ),
      },
    },
    {
      $set: {
        compute: $.reduce(
          $doc.compute,
          (handled, block) => {
            return $.concatArrays(handled, [
              $.mergeObjects(
                block,
                calculate(
                  $,
                  block,
                  $.concatArrays(
                    $doc.updates,
                    handled,
                    $doc.statics,
                    $doc.derivatives
                  )
                )
              ),
            ]);
          },
          [] as ComputationBlock[]
        ),
      },
    },
    {
      $set: {
        compute: {
          $reverseArray: $doc.compute,
        },
      },
    },
    /*
    {
      $set: {
        compute: {
          $sortArray: {
            input: $doc.compute,
            sortBy: {
              depth: 1,
            },
          },
        },
      },
    },
    */
    // Setting values before the relevant template fields might be introduced
    // as imports of imports (e.g. front page url being imported by sub-page,
    // and reimported by front page to create menu). Imports of imports
    // do not have a "result", and produces null.
    {
      $set: {
        values: $.mergeObjects(
          $.reduce(
            $doc.compute,
            (acc, el) =>
              $.cond(
                $.and(
                  $.eq($.substrBytes(el.id, 0, 4), $doc.id),
                  $.ne($.substrBytes(el.id, 0, 4), $.substrBytes(el.id, 4, 4))
                ),
                () =>
                  $.mergeObjects(
                    acc,
                    $.arrayToObject([
                      [$.substrBytes(el.id, 4, 12), (el as any).result],
                    ])
                  ),
                () => acc
              ),
            $doc.values
          )
        ),
      },
    },
    // purging and spreading imports of updates
    {
      $set: {
        compute: $.reduce(
          $.concatArrays(
            $doc.compute as (ComputationBlock & {
              imports: string[];
              depth: number;
            })[],
            $doc.updates as Update[],
            $doc.derivatives
          ),
          (acc, cur) => {
            return $.define()
              .let({
                baseDepth: $.max(
                  $.map(
                    $.filter(acc, (el) => $.in(cur.id, el.imports)),
                    (el) => el.depth
                  )
                ),
              })
              .return(({ baseDepth }) => {
                return $.cond(
                  $.or(
                    $.isNumber(baseDepth),
                    $.eq($.substrBytes(cur.id, 0, 4), $doc.id)
                  ),
                  () =>
                    $.concatArrays(
                      acc,
                      [
                        $.mergeObjects(cur, {
                          depth: $.add([$.ifNull(baseDepth, 0), 1]), // baseDepth may be null for native fields
                        }),
                      ],
                      $.cond(
                        $.isArray((cur as Update)._imports),
                        () =>
                          $.reduce(
                            (cur as Update)._imports,
                            (acc, nestedImport) =>
                              // we do not want to include the nested imports that are already in the values object as statics
                              $.cond(
                                $.in(
                                  nestedImport.id,
                                  queryArrayProp($doc.statics).id
                                ),
                                () => acc,
                                () =>
                                  $.concatArrays(acc, [
                                    $.mergeObjects(nestedImport, {
                                      depth: $.add([
                                        baseDepth,
                                        1,
                                        nestedImport.depth,
                                      ]),
                                    }),
                                  ])
                              ),
                            [] as Update["_imports"]
                          ),
                        () => [] as any[]
                      )
                    ),
                  () => acc
                );
              });
          },
          [] as (ComputationBlock & { imports: string[]; depth: number })[]
        ),
      },
    },
    {
      $set: {
        compute: $.sortArray(
          $doc.compute as (ComputationBlock & { depth: number })[],
          { depth: -1 }
        ),
      },
    },
    // deduplicate imports of updates
    {
      $set: {
        compute: $.reduce(
          $doc.compute,
          (acc, cur) =>
            $.cond(
              $.eq($.type($.find(acc, (el) => $.eq(cur.id, el.id))), "object"),
              () => acc, // do nothing since the existing one has the highest depth
              () => $.concatArrays(acc, [cur])
            ),
          [] as ComputationBlock[]
        ),
      },
    },
  ]);
};

export const createStages = (updates: Update[], derivatives: Update[] = []) => {
  return createCalculationStage(operators, updates, derivatives);
};

export const createCachedStage = () => {
  const $: Operators<
    DBDocument & {
      cached: string[];
      compute: (DBDocument["compute"][number] & { result: Value[] })[];
    }
  > = operators;
  return $.useDocument(($doc) => ({
    $set: {
      cached: $.map($doc.cached, (id) =>
        $.getField(
          $.ifNull(
            $.find($doc.compute, (el) => $.eq(el.id, id)),
            { result: [] as Value[] }
          ),
          "result"
        )
      ),
    },
  }));
};

export const createUnsetStage = () => ({
  $unset: [
    "updates",
    "derivatives",
    "statics",
    "compute.result",
    "compute.imports",
    "compute.function",
    "compute._imports",
    "compute.depth",
  ],
});
