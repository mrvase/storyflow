import { Narrow, Operators } from "./types";
import {
  FieldId,
  FunctionName,
  Operator,
  NestedElement,
  RawFieldId,
  NestedField,
  Parameter,
  DBDocumentRaw,
  NestedDocument,
  DBId,
  DBValueArray,
  HasDBId,
  DBSyntaxStreamBlock,
  DBSyntaxStream,
  NestedDocumentId,
} from "@storyflow/backend/types";
import { queryArrayProp } from "./queryArrayProp";

type Accummulator = {
  value: DBValueArray[];
  stack: DBValueArray[][];
  imports: DBId<FieldId>[];
  nested: string[];
  function: DBSyntaxStream;
  updated: boolean;
};

const calculateCombinations = (
  $: Operators<DBDocumentRaw>,
  value: DBValueArray[]
) => {
  return $.reduce(
    levelImplicitAndExplicitArrays($, value),
    (combinations, array) =>
      $.reduce(
        array,
        (result, element) =>
          $.concatArrays(
            result,
            $.map(combinations, (combination) =>
              $.concatArrays([], combination, [element])
            )
          ),
        [] as DBValueArray[]
      ),
    [[]] as DBValueArray[]
  );
};

const compute = (
  $: Operators<DBDocumentRaw>,
  operator: Operator | FunctionName | "root" | "}" | "]" | ")",
  acc: Accummulator
) =>
  $.switch()
    .case($.eq(operator, "root"), () => acc.value)
    .case($.in(operator, [")", "]"]), () =>
      $.define()
        .let({
          spread: $.reduce(
            acc.value,
            (acc, cur) =>
              $.reduce(
                cur,
                (acc, cur) =>
                  $.concatArrays(acc, [
                    $.cond(
                      $.isArray(cur),
                      () =>
                        $.cond(
                          $.eq($.size(cur as Narrow<typeof cur, any[]>), 1),
                          () => $.first(cur as Narrow<typeof cur, [any]>),
                          () => cur
                        ),
                      () => cur
                    ),
                  ]),
                acc
              ),
            [] as DBValueArray
          ),
        })
        .return(({ spread }) =>
          $.cond(
            $.eq(operator, "]"),
            () => [[spread]],
            () => [spread]
          )
        )
    )
    /*
    .case($.eq(operator, "}"), () => [
      [
        $.trim(
          $.reduce(
            acc.value,
            (acc, cur) =>
              $.reduceWithIndex(
                cur,
                (acc, cur, index) =>
                  $.cond(
                    $.in($.type(cur), ["object", "array"]),
                    () => $.concat([acc, " "]),
                    () =>
                      $.cond(
                        $.gt(index, 0),
                        () =>
                          $.concat([
                            $.trim(acc),
                            " ",
                            $.toString(cur as string),
                          ]),
                        () => $.concat([acc, $.toString(cur as string)])
                      )
                  ),
                acc
              ),
            ""
          )
        ),
      ],
    ])
    */
    .case($.eq(operator, "}"), () => [
      $.filter(
        $.reduce(
          acc.value,
          (acc, cur) =>
            $.reduceWithIndex(
              cur,
              (acc, cur, index) =>
                $.cond(
                  $.in($.type(cur), ["object", "array"]),
                  () =>
                    $.cond(
                      $.eq($.last(acc), ""),
                      () => acc,
                      () => $.concatArrays(acc, [""])
                    ),
                  () =>
                    $.cond(
                      $.gt(index, 0),
                      () => $.concatArrays(acc, [$.toString(cur as string)]),
                      () =>
                        $.concatArrays($.pop(acc), [
                          $.concat([$.last(acc), $.toString(cur as string)]),
                        ])
                    )
                ),
              acc
            ),
          [""] as string[]
        ),
        (el) => $.ne(el, "")
      ),
    ])
    .case($.eq(operator, "sum"), () => [])
    .case($.eq(operator, "filter"), () => [])
    .default(() =>
      $.define()
        .let({
          combinations: calculateCombinations($, acc.value),
        })
        .return(({ combinations }) => {
          return $.switch()
            .case($.eq(operator, "in"), () => [
              [
                $.reduce(
                  combinations,
                  (acc, values) =>
                    $.or(acc, $.eq($.at(values, 0), $.at(values, 1))),
                  false
                ),
              ],
            ])
            .case($.eq(operator, "concat"), () => [
              $.reduce(
                combinations,
                (acc, values) =>
                  $.concatArrays(
                    acc,
                    $.reduce(
                      values,
                      (acc, cur) =>
                        $.cond(
                          $.and(
                            $.or($.isNumber(cur), $.eq($.type(cur), "string")),
                            $.or(
                              $.isNumber($.last(acc)),
                              $.eq($.type($.last(acc)), "string")
                            )
                          ),
                          () =>
                            $.concatArrays($.pop(acc), [
                              $.concat([
                                $.toString($.last(acc)),
                                $.toString(cur),
                              ]),
                            ]),
                          () => $.concatArrays(acc, [cur])
                        ),
                      [] as DBValueArray
                    )
                  ),
                [] as DBValueArray
              ),
            ])
            .case($.in(operator, ["url", "slug"]), () => [
              $.map(combinations, (values) =>
                $.toLower(
                  $.reduce(
                    values,
                    (acc, cur) =>
                      $.concat([
                        acc,
                        $.switch()
                          .case($.isNumber(cur), () => $.toString(cur))
                          .case($.eq($.type(cur), "string"), () =>
                            $.concat([
                              $.cond(
                                $.and(
                                  $.eq(operator, "url"),
                                  $.ne(cur, ""),
                                  $.ne(acc, "")
                                ),
                                () => "/",
                                () => ""
                              ),
                              replaceAllWithRegex(
                                $,
                                cur as string,
                                $.cond(
                                  $.eq(operator, "url"),
                                  () => "[^\\w\\-\\*\\/]",
                                  () => "[^\\w\\-]"
                                ),
                                "i"
                              ),
                            ])
                          )
                          .default(() => ""),
                      ]),
                    ""
                  )
                )
              ),
            ])
            .case($.eq(operator, "="), () => [
              $.map(combinations, (values) =>
                $.eq($.at(values, 0), $.at(values, 1))
              ),
            ])
            .case($.in(operator, ["+", "-"]), () => [
              $.map(combinations, (values) =>
                $.reduce(
                  $.slice(values, 1),
                  (a, c) =>
                    $.switch()
                      .case($.eq(operator, "+"), () => $.add([a, $.number(c)]))
                      .case($.eq(operator, "-"), () =>
                        $.subtract([a, $.number(c)])
                      )
                      .default(() => a),
                  $.number($.first(values))
                )
              ),
            ])
            .case($.in(operator, ["*", "/"]), () => [
              $.map(combinations, (values) =>
                $.reduce(
                  $.slice(values, 1),
                  (a, c) =>
                    $.switch()
                      .case($.eq(operator, "*"), () =>
                        $.multiply([a, $.number(c, 1)])
                      )
                      .case($.eq(operator, "/"), () =>
                        $.divide([a, $.number(c, 1)])
                      )
                      .default(() => a),
                  $.number($.first(values), 1)
                )
              ),
            ])
            .default(() => combinations);
        })
    );

const isObjectWithProp = <Object, Prop extends string>(
  $: Operators<DBDocumentRaw>,
  object: Object,
  prop: Prop,
  type:
    | "string"
    | "undefined"
    | "object"
    | "array"
    | "bool"
    | "null"
    | "double"
    | "date"
    | "objectId"
): boolean => {
  return $.cond(
    $.eq($.type(object), "object"),
    () => {
      return $.eq($.type((object as any)[prop]), type);
    },
    () => false
  );
};

const levelImplicitAndExplicitArrays = (
  $: Operators<DBDocumentRaw>,
  arr: DBValueArray[]
): DBValueArray[] => {
  return $.reduce(
    arr,
    (acc, cur) =>
      $.concatArrays(acc, [
        $.cond(
          $.isArray($.first(cur)),
          () => $.first(cur),
          () => cur
        ),
      ]),
    [] as DBValueArray[]
  );
};

const slugCharacters = [
  [" ", "-"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
];

const replaceAllWithRegex = (
  $: Operators<DBDocumentRaw>,
  string: string,
  regex: string,
  options: string
) => {
  return $.reduce(
    $.regexFindAll(string, regex, options),
    (acc, cur) =>
      $.replaceOne(
        acc,
        cur.match,
        $.define()
          .let({
            repl: $.filter(slugCharacters, (ref) =>
              $.eq(cur.match, $.first(ref))
            ),
          })
          .return(({ repl }) =>
            $.cond(
              $.eq($.size(repl), 1),
              () => $.last($.first(repl)),
              () => ""
            )
          )
      ),
    string
  );
};

type IgnorableImport = { field: DBId<FieldId>; ignore: boolean };
type StreamWithIgnorableImport = (DBSyntaxStream[number] | IgnorableImport)[];

export const calculate = (
  $: Operators<DBDocumentRaw>,
  block: DBSyntaxStreamBlock,
  imports: DBSyntaxStreamBlock[]
) => {
  return $.define()
    .let({
      result: $.reduce(
        block.v,
        (acc, cur) => {
          return $.define()
            .let({
              isSelect: isObjectWithProp($, cur, "f", "string"),
              nestedDocumentId: $.cond(
                $.or(
                  $.eq($.type((cur as any).element), "string"),
                  $.eq($.type((cur as any).folder), "objectId"),
                  $.eq($.type((cur as any).field), "objectId")
                ),
                () =>
                  $.substrBytes(
                    $.toString(
                      (
                        cur as Narrow<
                          typeof cur,
                          { id: DBId<NestedDocumentId> }
                        >
                      ).id
                    ),
                    12,
                    12
                  ),
                () => null
              ),
            })
            .let(({ isSelect, nestedDocumentId }) => ({
              children: $.cond(
                $.toBool(nestedDocumentId),
                () =>
                  $.filter(
                    imports as (DBSyntaxStreamBlock & {
                      result: DBSyntaxStream;
                      function: DBSyntaxStream;
                      updated?: boolean;
                    })[],
                    (el) =>
                      $.eq(
                        $.substrBytes($.toString(el.k), 0, 12),
                        nestedDocumentId!
                      )
                  ),
                () => []
              ),
              next: $.cond(
                isSelect,
                () =>
                  $.concatArrays(
                    [{ "(": true }],
                    $.reduce(
                      acc.value,
                      (acc: DBSyntaxStream, comp) =>
                        $.reduce(
                          comp,
                          (acc, el) =>
                            $.cond(
                              isObjectWithProp($, el, "id", "objectId"),
                              () =>
                                $.concatArrays(acc, [
                                  { "[": true },
                                  {
                                    field: $.toObjectId(
                                      $.concat([
                                        $.substrBytes(
                                          $.toString(
                                            (el as HasDBId<NestedDocument>).id
                                          ),
                                          12,
                                          12
                                        ),
                                        (
                                          cur as Narrow<
                                            typeof cur,
                                            { f: RawFieldId }
                                          >
                                        ).f,
                                      ])
                                    ),
                                  } as HasDBId<NestedField>,
                                  {
                                    "]": true,
                                  },
                                ]),
                              () => acc
                            ),
                          acc
                        ),
                      []
                    ),
                    [{ ")": true }]
                  ),
                () => [cur]
              ),
              acc: $.mergeObjects(
                acc,
                $.cond(
                  isSelect,
                  () => ({
                    value: $.last(acc.stack),
                    stack: $.pop(acc.stack),
                  }),
                  () => ({})
                ),
                $.cond(
                  $.toBool(nestedDocumentId),
                  () => ({
                    nested: $.setUnion(acc.nested, [nestedDocumentId]),
                  }),
                  () => ({})
                )
              ),
            }))
            .return(({ next, acc, children }) =>
              $.reduce(
                next,
                (acc, cur) =>
                  $.define()
                    .let({
                      isImport: isObjectWithProp($, cur, "field", "objectId"),
                    })
                    .let(({ isImport }) => ({
                      importedField: $.cond(
                        isImport,
                        () =>
                          $.find(imports, (el) =>
                            $.eq(el.k, (cur as HasDBId<NestedField>).field)
                          ) as DBSyntaxStreamBlock & {
                            result: DBSyntaxStream;
                            function: DBSyntaxStream;
                            updated?: boolean;
                          },
                        () => null
                      ),
                    }))
                    .let(({ isImport, importedField }) => ({
                      next: $.switch()
                        .case(
                          $.and(isImport, $.not($.toBool(importedField))),
                          () => []
                        )
                        .case($.toBool(importedField), () =>
                          $.concatArrays(
                            [{ "(": true }] as DBSyntaxStream,
                            $.cond(
                              $.gt($.size(children), 0),
                              () =>
                                $.getField(
                                  importedField as Exclude<
                                    typeof importedField,
                                    null
                                  >,
                                  "function"
                                ) as DBSyntaxStream,
                              () =>
                                $.getField(
                                  importedField as Exclude<
                                    typeof importedField,
                                    null
                                  >,
                                  "result"
                                ) as DBSyntaxStream
                            ),
                            [{ ")": true }] as DBSyntaxStream
                          )
                        )
                        .default(() => [
                          cur as Exclude<typeof cur, IgnorableImport>,
                        ]),
                    }))
                    .return(({ importedField, next }) => {
                      return $.mergeObjects(
                        $.reduce(
                          next,
                          (acc, cur) =>
                            $.cond(
                              $.eq($.type(cur), "object"),
                              () => {
                                const curObj = cur as Narrow<
                                  typeof cur,
                                  object
                                >;
                                return (
                                  $.switch()
                                    // if [number]:
                                    .case($.isNumber((curObj as any).x), () =>
                                      $.define()
                                        .let({
                                          arg: $.find(children, (child) =>
                                            $.eq(
                                              $.substrBytes(
                                                $.toString(child.k),
                                                23,
                                                1
                                              ),
                                              $.toString(
                                                (curObj as Parameter).x
                                              )
                                            )
                                          ),
                                        })
                                        .return(({ arg }) =>
                                          $.mergeObjects(acc, {
                                            value: $.concatArrays(
                                              acc.value,
                                              $.switch()
                                                .case($.toBool(arg), () => [
                                                  arg!.result,
                                                ])
                                                .case(
                                                  $.ne(
                                                    $.type(
                                                      (curObj as Parameter)
                                                        .value
                                                    ),
                                                    "missing"
                                                  ),
                                                  () => [
                                                    [
                                                      (curObj as Parameter)
                                                        .value!,
                                                    ],
                                                  ]
                                                )
                                                .default(() => [])
                                            ),
                                          })
                                        )
                                    )
                                    // if "n": IGNORE
                                    // if "/": DO NOT IGNORE - will be handled by merge
                                    .case(
                                      $.eq($.type((cur as any).n), "bool"),
                                      () => acc
                                    )
                                    // if nested element: IGNORE
                                    .case(
                                      $.eq(
                                        $.type((cur as any).element),
                                        "string"
                                      ),
                                      () => acc
                                    )
                                    // if "(" or "{" "[": STACK
                                    .case(
                                      $.in("bool", [
                                        $.type((cur as any)["("]),
                                        $.type((cur as any)["{"]),
                                        $.type((cur as any)["["]),
                                      ]),
                                      () =>
                                        $.mergeObjects(acc, {
                                          stack: $.concatArrays(acc.stack, [
                                            acc.value,
                                          ]),
                                          value: [],
                                        })
                                    )
                                    .default(() =>
                                      $.define()
                                        .let({
                                          operator: $.switch()
                                            .case(
                                              $.eq(
                                                $.type((cur as any)[")"]),
                                                "string"
                                              ),
                                              () =>
                                                (
                                                  cur as Narrow<
                                                    typeof cur,
                                                    {
                                                      ")":
                                                        | Operator
                                                        | FunctionName;
                                                    }
                                                  >
                                                )[")"]
                                            )
                                            .case(
                                              $.eq(
                                                $.type((cur as any)["}"]),
                                                "bool"
                                              ),
                                              () => "}" as "}"
                                            )
                                            .case(
                                              $.eq(
                                                $.type((cur as any)[")"]),
                                                "bool"
                                              ),
                                              () => ")" as ")"
                                            )
                                            .case(
                                              $.eq(
                                                $.type((cur as any)["]"]),
                                                "bool"
                                              ),
                                              () => "]" as "]"
                                            )
                                            .default(() => null),
                                        })
                                        .return(({ operator }) => {
                                          return $.cond(
                                            $.eq(operator, null),
                                            () =>
                                              $.mergeObjects(acc, {
                                                value: $.concatArrays(
                                                  acc.value,
                                                  [[cur as any]]
                                                ),
                                              }),
                                            () => {
                                              return $.mergeObjects(acc, {
                                                value: $.concatArrays(
                                                  $.last(acc.stack),
                                                  compute(
                                                    $,
                                                    operator as Exclude<
                                                      typeof operator,
                                                      null
                                                    >,
                                                    acc
                                                  )
                                                ),
                                                stack: $.pop(acc.stack),
                                              });
                                            }
                                          );
                                        })
                                    )
                                );
                              },
                              () =>
                                $.mergeObjects(acc, {
                                  value: $.concatArrays(acc.value, [
                                    [cur as any],
                                  ]),
                                })
                            ),
                          acc
                        ),
                        {
                          imports: $.cond(
                            $.toBool(importedField),
                            () => $.setUnion(acc.imports, [importedField?.k]),
                            () => acc.imports
                          ),
                          updated: $.or(
                            acc.updated,
                            $.anyElementTrue(queryArrayProp(children).updated!),
                            $.toBool(importedField?.updated)
                          ),
                          function: $.concatArrays(acc.function, next),
                        }
                      );
                    }),
                acc
              )
            );
        },
        {
          value: [],
          stack: [],
          imports: [],
          nested: [],
          function: [],
          updated: false,
        } as Accummulator
      ),
    })
    .return(({ result }) => ({
      result: $.reduce(
        result.value,
        (acc, cur) => $.concatArrays(acc, cur),
        [] as DBValueArray
      ),
      imports: result.imports,
      function: result.function,
      nested: result.nested,
      updated: result.updated,
    }));
};
