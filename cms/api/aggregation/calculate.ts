import { Narrow, Operators } from "./types";
import {
  DBDocument,
  FieldId,
  FieldImport,
  FunctionName,
  Operator,
  FlatFieldImport,
  DocumentId,
  PrimitiveValue,
  TemplateFieldId,
  FlatValue,
  PossiblyNestedFlatComputation,
  FlatLayoutElement,
  DBSymbol,
  FlatPlaceholder,
} from "@storyflow/backend/types";

type Parameter = { x: number; value?: PrimitiveValue };

export type FlatComputation = (FlatValue | FlatPlaceholder | DBSymbol)[];

type ComputationBlock = {
  id: FieldId;
  value: FlatComputation;
};

type Accummulator = {
  value: FlatValue[][];
  stack: FlatValue[][][];
  imports: FieldId[];
  function: PossiblyNestedFlatComputation;
};

const calculateCombinations = (
  $: Operators<DBDocument>,
  value: FlatValue[][]
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
        [] as FlatComputation[]
      ),
    [[]] as FlatComputation[]
  );
};

const compute = (
  $: Operators<DBDocument>,
  operator: Operator | FunctionName | "}" | "]" | ")",
  acc: Accummulator
) =>
  $.switch()
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
            [] as FlatValue[]
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
                      [] as FlatComputation
                    )
                  ),
                [] as FlatComputation
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
  $: Operators<DBDocument>,
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
  $: Operators<DBDocument>,
  arr: FlatValue[][]
): FlatValue[][] => {
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
    [] as FlatValue[][]
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
  $: Operators<DBDocument>,
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

type IgnorableImport = { fref: string; ignore: boolean };
type FlatComputationWithIgnorableImport = (
  | FlatComputation[number]
  | IgnorableImport
)[];

export const calculate = (
  $: Operators<DBDocument>,
  block: ComputationBlock,
  imports: ComputationBlock[]
) => {
  return $.define()
    .let({
      result: $.reduce(
        block.value,
        (acc, cur) => {
          return $.define()
            .let({ pick: isObjectWithProp($, cur, "p", "string") })
            .let(({ pick }) => ({
              next: $.switch()
                .case(isObjectWithProp($, cur, "type", "string"), () =>
                  $.concatArrays(
                    [{ "(": true }, ""] as FlatComputationWithIgnorableImport,
                    $.reduce(
                      $.objectToArray((cur as FlatLayoutElement).props),
                      (acc, el) =>
                        $.concatArrays(acc, [
                          {
                            fref: $.concat([(cur as any).id, "/", el.k]),
                            ignore: $.not(el.v),
                          },
                        ]),
                      [] as FlatComputationWithIgnorableImport
                    ),
                    ["", { ")": true }] as FlatComputationWithIgnorableImport
                  )
                )
                .case(pick, () =>
                  $.concatArrays(
                    [{ "(": true }] as FlatComputationWithIgnorableImport,
                    $.reduce(
                      acc.value,
                      (acc, comp) =>
                        $.reduce(
                          comp,
                          (acc, el) =>
                            $.cond(
                              isObjectWithProp($, el, "dref", "string"),
                              () =>
                                $.concatArrays(acc, [
                                  { "[": true },
                                  {
                                    fref: $.concat([
                                      (
                                        el as Narrow<
                                          typeof el,
                                          { dref: DocumentId }
                                        >
                                      ).dref,
                                      (
                                        cur as Narrow<
                                          typeof cur,
                                          { p: TemplateFieldId }
                                        >
                                      ).p,
                                    ]),
                                  } as FieldImport,
                                  {
                                    "]": true,
                                  },
                                ]),
                              () =>
                                $.concatArrays(acc, [
                                  { "[": true },
                                  {
                                    fref: $.concat([
                                      (el as Narrow<typeof el, { id: string }>)
                                        .id,
                                      "/",
                                      (
                                        cur as Narrow<
                                          typeof cur,
                                          { p: TemplateFieldId }
                                        >
                                      ).p,
                                    ]),
                                  } as FieldImport,
                                  {
                                    "]": true,
                                  },
                                ])
                            ),
                          acc
                        ),
                      [] as FlatComputationWithIgnorableImport
                    ),
                    [{ ")": true }] as FlatComputationWithIgnorableImport
                  )
                )
                .default(() => [cur]),
              acc: $.cond(
                pick,
                () =>
                  $.mergeObjects(acc, {
                    value: $.last(acc.stack),
                    stack: $.pop(acc.stack),
                  }),
                () => acc
              ),
            }))
            .return(({ next, acc }) =>
              $.reduce(
                next,
                (acc, cur) =>
                  $.define()
                    .let({
                      imp: $.cond(
                        isObjectWithProp($, cur, "fref", "string"),
                        () => cur as FieldImport | IgnorableImport,
                        () => null
                      ),
                    })
                    .let(({ imp }) => ({
                      args: $.cond(
                        $.toBool((imp as FieldImport).id), // do not look for args if it is ignorable import
                        () =>
                          $.map(
                            $.range(0, 2),
                            (index) =>
                              $.find(imports, (el) =>
                                $.eq(
                                  el.id,
                                  $.concat([
                                    (imp as FieldImport).id,
                                    "/",
                                    $.toString(index),
                                  ]) as FieldId
                                )
                              ) as ComputationBlock & {
                                result: PossiblyNestedFlatComputation;
                                function: PossiblyNestedFlatComputation;
                              }
                          ),
                        () => [null]
                      ),
                      importedField: $.cond(
                        $.toBool(imp),
                        () =>
                          $.find(imports, (el) =>
                            $.eq(el.id, (imp as FieldImport).fref)
                          ) as ComputationBlock & {
                            result: PossiblyNestedFlatComputation;
                            function: PossiblyNestedFlatComputation;
                          },
                        () => null
                      ),
                    }))
                    .let(({ imp, importedField, args }) => ({
                      next: $.switch()
                        .case(
                          $.and(
                            $.toBool(imp),
                            $.or(
                              $.not($.toBool(importedField)),
                              $.toBool((imp as IgnorableImport).ignore)
                            )
                          ),
                          () => []
                        )
                        .case($.toBool(importedField), () =>
                          $.concatArrays(
                            [{ "(": true }] as FlatComputation,
                            $.cond(
                              $.anyElementTrue(args),
                              () =>
                                $.getField(
                                  importedField as Exclude<
                                    typeof importedField,
                                    null
                                  >,
                                  "function"
                                ),
                              () =>
                                $.getField(
                                  importedField as Exclude<
                                    typeof importedField,
                                    null
                                  >,
                                  "result"
                                )
                            ),
                            [{ ")": true }] as FlatComputation
                          )
                        )
                        .default(() => [cur]),
                    }))
                    .return(({ imp, args, next }) => {
                      // console.log("IMP", imp, args);
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
                                          arg: $.at(
                                            args,
                                            (curObj as Parameter).x
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
                                    // if fetcher: IGNORE
                                    .case(
                                      $.eq(
                                        $.type((cur as any).filters),
                                        "array"
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
                                                  [[cur]]
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
                                  value: $.concatArrays(acc.value, [[cur]]),
                                })
                            ),
                          acc
                        ),
                        {
                          imports: $.setUnion(
                            acc.imports,
                            [$.ifNull(imp?.fref, "")],
                            $.reduce(
                              $.range(0, 2),
                              (acc, index) =>
                                $.cond(
                                  $.toBool($.at(args, index)),
                                  () =>
                                    $.concatArrays(acc, [
                                      $.concat([
                                        (imp as FieldImport).id,
                                        "/",
                                        $.toString(index),
                                      ]),
                                    ]),
                                  () => acc
                                ),
                              [] as string[]
                            )
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
          function: [],
        } as Accummulator
      ),
    })
    .return(({ result }) => ({
      result: $.reduce(
        result.value,
        (acc, cur) => $.concatArrays(acc, cur),
        [] as FlatComputation
      ),
      imports: result.imports,
      function: result.function,
    }));
};
