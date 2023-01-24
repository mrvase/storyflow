export interface UrlTab {
  segment: string;
  index: number;
}

export interface Tab extends UrlTab {
  order: number;
  key: string;
}
