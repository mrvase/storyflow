const calculate = (a: any, b: any) => [];

const nestedCalculate = (value: any[], imports: any[]) => {
  const calc = (value: any[]): any => {
    return calculate(value, (id: string) => {
      const importedField = imports.find((el) => el.id === id);
      return calc(importedField.fields);
    });
  };
  return calc(value);
};

export function prepareComponent(component: any, imports: any[]) {
  return {
    elements: component.elements.map((el: any) => {
      return {
        id: el.id,
        type: el.type,
        props: Object.fromEntries(
          Object.entries(el.props).map(([key, value]: [any, any]) => {
            return [key, nestedCalculate(value, imports)];
          })
        ),
      };
    }),
  };
}
