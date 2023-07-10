export const createFilterFn = (filters: Record<string, any>) => {
  const entries = Object.entries(filters);
  return (el: any) => {
    return entries.every(([name, value]) => el[name] === value);
  };
};

export const createSortFn = (sort: Record<string, 1 | -1>) => {
  const entries = Object.entries(sort);
  return (a: any, b: any) => {
    for (const [name, value] of entries) {
      if (a[name] < b[name]) {
        return value;
      }
      if (a[name] > b[name]) {
        return -value;
      }
    }
    return 0;
  };
};
