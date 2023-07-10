import type { Operators } from "../aggregation/types";
import type {
  DBDocumentRaw,
  DBId,
  DBSyntaxStream,
  DBSyntaxStreamBlock,
  DBValueArray,
} from "../types";
import type { FieldId, Value } from "@storyflow/shared/types";
import { calculate } from "./calculate";
import { createOperators } from "../aggregation/mongo-operators";
import { queryArrayProp } from "../aggregation/queryArrayProp";

export type Update = DBSyntaxStreamBlock & {
  result: DBValueArray;
  // imports: DBId<FieldId>[];
  // nested: string[];
  depth: number;
  updated: boolean;
  _imports: (DBSyntaxStreamBlock & { depth: number })[];
};

type Options = {
  cache?: boolean;
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
        idString: $.substrBytes($.toString($doc._id), 12, 12),
      },
    },
    {
      $set: {
        updates: $.filter(updates, (update) =>
          $.in(update.k, queryArrayProp($doc.fields).k)
        ),
        derivatives,
        statics: $.filter(
          $.map($.objectToArray($doc.values), (el) => ({
            k: $.toObjectId($.concat([$doc.idString, el.k])),
            result: el.v as DBSyntaxStream,
          })),
          (el) => $.not($.in(el.k, queryArrayProp($doc.fields).k))
        ),
      },
    },
    {
      $set: {
        fields: $.define()
          .let({ size: $.size($doc.fields) })
          .return(({ size }) =>
            $.map($.range(0, size), (index) =>
              $.mergeObjects($.at($doc.fields, index), {
                depth: $.subtract([size, index]),
              })
            )
          ),
      },
    },
    {
      $set: {
        fields: $.filter($doc.fields, (field) =>
          $.not(
            $.in(
              field.k,
              updates.map((el) => el.k)
            )
          )
        ),
      },
    },
    {
      $set: {
        fields: $.reduce(
          $doc.fields,
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
    // reversing
    // moves fields that imports other fields up front.
    // a non-imported field will always lead.
    {
      $set: {
        fields: $.reverseArray($doc.fields),
      },
    },
    /*
    {
      $set: {
        fields: {
          $sortArray: {
            input: $doc.fields,
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
            $doc.fields,
            (acc, el) =>
              $.cond(
                $.and(
                  $.eq($.substrBytes($.toString(el.k), 0, 12), $doc.idString),
                  $.ne($.substrBytes($.toString(el.k), 14, 4), "0000")
                ),
                () =>
                  $.mergeObjects(
                    acc,
                    $.arrayToObject([
                      [
                        $.substrBytes($.toString(el.k), 12, 12),
                        (el as any).result,
                      ],
                    ])
                  ),
                () => acc
              ),
            $doc.values
          )
        ),
        updated: $.mergeObjects(
          $.reduce(
            $doc.fields as (DBSyntaxStreamBlock & {
              updated: boolean;
            })[],
            (acc, el) =>
              $.cond(
                $.and(
                  $.eq($.substrBytes($.toString(el.k), 0, 12), $doc.idString),
                  $.eq(el.updated, true)
                ),
                () =>
                  $.mergeObjects(
                    acc,
                    $.arrayToObject([
                      [$.substrBytes($.toString(el.k), 12, 12), Date.now()],
                    ])
                  ),
                () => acc
              ),
            $doc.updated
          )
        ),
      },
    },
    ...(options.cache
      ? [
          {
            $set: {
              cached: $.map($doc.cached, (id) => ({
                k: id,
                v: $.getField(
                  $.ifNull(
                    $.find(
                      $doc.fields as (DBSyntaxStreamBlock & {
                        result: Value[];
                      })[],
                      (el) => $.eq(el.k, id)
                    ),
                    { result: [] as Value[] }
                  ),
                  "result"
                ),
              })),
            },
          },
        ]
      : []),
    // purging and spreading imports of updates
    {
      $set: {
        fields: $.reduce(
          $.concatArrays(
            $doc.fields as (DBSyntaxStreamBlock & {
              imports?: DBId<FieldId>[];
              nested?: string[];
              depth: number;
            })[],
            $doc.updates,
            $doc.derivatives
          ),
          (acc, cur) => {
            return $.define()
              .let({
                parent: $.substrBytes($.toString(cur.k), 0, 12),
              })
              .let(({ parent }) => ({
                baseDepth: $.max(
                  $.map(
                    $.filter(acc, (el) =>
                      $.cond(
                        $.and($.isArray(el.nested), $.isArray(el.imports)),
                        // imports and imports of imports that do not have these arrays are not relevant
                        () =>
                          $.or(
                            $.in(parent, el.nested),
                            $.in(cur.k, el.imports)
                          ),
                        () => false
                      )
                    ),
                    (el) => el.depth
                  )
                ),
              }))
              .return(({ parent, baseDepth }) => {
                return $.cond(
                  $.or($.isNumber(baseDepth), $.eq(parent, $doc.idString)),
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
                                  nestedImport.k,
                                  queryArrayProp($doc.statics).k
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
            nested: string[];
            depth: number;
          })[]
        ),
      },
    },
    // sorting
    {
      $set: {
        fields: $.sortArray(
          $doc.fields as (DBSyntaxStreamBlock & { depth: number })[],
          { depth: -1 }
        ),
      },
    },
    // deduplicate imports of updates
    {
      $set: {
        fields: $.reduce(
          $doc.fields,
          (acc, cur) =>
            $.cond(
              $.eq($.type($.find(acc, (el) => $.eq(cur.k, el.k))), "object"),
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
        "fields.result",
        "fields.imports",
        "fields.function",
        "fields._imports",
        "fields.depth",
        "fields.nested",
        "fields.updated",
      ],
    },
  ]);
};

export const createStages = (
  updates: Update[],
  derivatives: Update[] = [],
  options?: Options
) => {
  return createCalculationStage(
    createOperators(),
    updates,
    derivatives,
    options
  );
};

/*

export const createCachedStage = () => {
  const $: Operators<
    DBDocument & {
      cached: string[];
      fields: (DBDocument["fields"][number] & { result: Value[] })[];
    }
  > = operators;
  return $.useDocument(($doc) => ({
    $set: {
      cached: $.map($doc.cached, (id) =>
        $.getField(
          $.ifNull(
            $.find($doc.fields, (el) => $.eq(el.id, id)),
            { result: [] as Value[] }
          ),
          "result"
        )
      ),
    },
  }));
};
*/
