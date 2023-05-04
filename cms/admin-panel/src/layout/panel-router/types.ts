export type PanelData = {
  key: string;
  // normal format: /tab1-1/tab1-2/...
  path: string;
  // We do not reorder the panels but change their flex order.
  // Therefore the index is actually the key, since the list never reorders
  index: number;
};

export type Panels = {
  prefix: string;
  data: PanelData[];
};

export type RouteConfig = {
  matcher: RegExp;
  component: React.FC<{ children?: React.ReactNode }>;
};
