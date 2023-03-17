import { Narrow, Operators } from "./types";
import {
  DBDocumentRaw,
  DBId,
  DBSyntaxStream,
  DBSyntaxStreamBlock,
  DBValue,
  DBValueArray,
  FieldId,
  Value,
} from "@storyflow/backend/types";
import { calculate } from "./calculate";
import { operators } from "./mongo-operators";

export type Update = DBSyntaxStreamBlock & {
  result: DBValueArray;
  imports: DBId<FieldId>[];
  depth: number;
  _imports: (DBSyntaxStreamBlock & { depth: number })[];
};

type Options = {
  cache?: boolean;
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
    DBDocumentRaw & {
      idString: string;
      updates: Update[];
      derivatives: Update[];
      statics: DBSyntaxStreamBlock[];
      cached: DBId<FieldId>[];
    }
  >,
  updates: Update[],
  derivatives: Update[],
  options: Options = {}
) => {
  return $.useDocument(($doc) => [
    {
      $set: {
        idString: $.substrBytes($.toString($doc._id), 12, 24),
      },
    },
    {
      $set: {
        updates: $.filter(updates, (update) =>
          $.in(update.id, queryArrayProp($doc.compute).id)
        ),
        derivatives,
        statics: $.filter(
          $.map($.objectToArray($doc.values), (el) => ({
            id: $.toObjectId($.concat([$doc.idString, el.k])),
            result: el.v as DBSyntaxStream,
          })),
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
          [] as DBSyntaxStreamBlock[]
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
                  $.eq($.substrBytes($.toString(el.id), 0, 12), $doc.idString),
                  $.ne($.substrBytes($.toString(el.id), 14, 18), "0000")
                ),
                () =>
                  $.mergeObjects(
                    acc,
                    $.arrayToObject([
                      [
                        $.substrBytes($.toString(el.id), 12, 24),
                        (el as any).result,
                      ],
                    ])
                  ),
                () => acc
              ),
            $doc.values
          )
        ),
      },
    },
    ...(options.cache
      ? [
          {
            $set: {
              cached: $.map($doc.cached, (id) =>
                $.getField(
                  $.ifNull(
                    $.find(
                      $doc.compute as (DBSyntaxStreamBlock & {
                        result: Value[];
                      })[],
                      (el) => $.eq(el.id, id)
                    ),
                    { result: [] as Value[] }
                  ),
                  "result"
                )
              ),
            },
          },
        ]
      : []),
    // purging and spreading imports of updates
    {
      $set: {
        compute: $.reduce(
          $.concatArrays(
            $doc.compute as (DBSyntaxStreamBlock & {
              imports: DBId<FieldId>[];
              depth: number;
            })[],
            $doc.updates,
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
                    $.eq(
                      $.substrBytes($.toString(cur.id), 0, 12),
                      $doc.idString
                    )
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
                                      // Add empty import array to avoid type error when looking for base depth in the subsequent iteration.
                                      // One might wonder if not it should contain actual imports so that it would be found when looking for base depth.
                                      // But all its imports are added here as nested imports as well containing the higher depth.
                                      // They will therefore stay when deduplication happens later.
                                      imports: [],
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
          [] as (DBSyntaxStreamBlock & {
            imports: DBId<FieldId>[];
            depth: number;
          })[]
        ),
      },
    },
    {
      $set: {
        compute: $.sortArray(
          $doc.compute as (DBSyntaxStreamBlock & { depth: number })[],
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
          [] as DBSyntaxStreamBlock[]
        ),
      },
    },
    {
      $unset: [
        "idString",
        "updates",
        "derivatives",
        "statics",
        "compute.result",
        "compute.imports",
        "compute.function",
        "compute._imports",
        "compute.depth",
      ],
    },
  ]);
};

export const createStages = (
  updates: Update[],
  derivatives: Update[] = [],
  options?: Options
) => {
  return createCalculationStage(operators, updates, derivatives, options);
};

/*

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
*/
