export interface Path {
  // A URL pathname, beginning with a /.
  pathname: string;
  // A URL search string, beginning with a ?.
  search: string;
  // A URL fragment identifier, beginning with a #.
  hash: string;
}

export type To = string | Partial<Path>;

export interface Location extends Path {
  /**
   * A value of arbitrary data associated with this location.
   */
  state: any;

  /**
   * A unique string associated with this location. May be used to safely store
   * and retrieve data in some other storage API, like `localStorage`.
   *
   * Note: This value is always "default" on the initial location.
   */
  key: string;
}

export type Action = "POP" | "PUSH" | "REPLACE";

export interface Update {
  /**
   * The action that triggered the change.
   */
  action: Action;

  /**
   * The new location.
   */
  location: Location;
}

/**
 * A function that receives notifications about location changes.
 */
export interface Listener {
  (update: Update): void;
}

export interface History {
  /**
   * The last action that modified the current location. This will always be
   * Action.Pop when a history instance is first created. This value is mutable.
   */
  readonly action: Action;

  /**
   * The current location. This value is mutable.
   */
  readonly location: Location;

  /**
   * Returns a valid href for the given `to` value that may be used as
   * the value of an <a href> attribute.
   *
   * @param to - The destination URL
   */
  createHref(to: To): string;

  /**
   * Pushes a new location onto the history stack, increasing its length by one.
   * If there were any entries in the stack after the current one, they are
   * lost.
   *
   * @param to - The new URL
   * @param state - Data to associate with the new location
   */
  push(to: To, state?: any): void;

  /**
   * Replaces the current location in the history stack with a new one.  The
   * location that was replaced will no longer be available.
   *
   * @param to - The new URL
   * @param state - Data to associate with the new location
   */
  replace(to: To, state?: any): void;

  /**
   * Navigates `n` entries backward/forward in the history stack relative to the
   * current index. For example, a "back" navigation would use go(-1).
   *
   * @param delta - The delta in the stack index
   */
  go(delta: number): void;

  /**
   * Sets up a listener that will be called whenever the current location
   * changes.
   *
   * @param listener - A function that will be called when the location changes
   * @returns unlisten - A function that may be used to stop listening
   */
  listen(listener: Listener): () => void;
}

export interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
  state?: any;
}

export interface Navigator {
  createHref: History["createHref"];
  go: History["go"];
  push(to: To, state?: any, opts?: NavigateOptions): void;
  replace(to: To, state?: any, opts?: NavigateOptions): void;
}

export interface AgnosticRouteObject {
  caseSensitive?: boolean;
  children?: AgnosticRouteObject[];
  index?: boolean;
  path?: string;
  id?: string;
  hasErrorBoundary?: boolean;
  handle?: any;
}

export interface RouteObject extends AgnosticRouteObject {
  children?: RouteObject[];
  element?: React.ReactNode | null;
  errorElement?: React.ReactNode | null;
}

export type Params<Key extends string = string> = {
  readonly [key in Key]: string | undefined;
};

export interface AgnosticRouteMatch<
  ParamKey extends string = string,
  RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject
> {
  /**
   * The names and values of dynamic parameters in the URL.
   */
  params: Params<ParamKey>;
  /**
   * The portion of the URL pathname that was matched.
   */
  pathname: string;
  /**
   * The portion of the URL pathname that was matched before child routes.
   */
  pathnameBase: string;
  /**
   * The route object that was used to match.
   */
  route: RouteObjectType;
}

export interface RouterInit {
  routes: AgnosticRouteObject[];
  history: History;
}

export interface RouteMatch<
  ParamKey extends string = string,
  RouteObjectType extends RouteObject = RouteObject
> extends AgnosticRouteMatch<ParamKey, RouteObjectType> {}

export interface RouterSubscriber {
  (state: RouterState): void;
}

export interface Router {
  /**
   * @internal
   * PRIVATE - DO NOT USE
   *
   * Return the current state of the router
   */
  get state(): RouterState;

  /**
   * @internal
   * PRIVATE - DO NOT USE
   *
   * Return the routes for this router instance
   */
  get routes(): AgnosticRouteObject[];

  /**
   * @internal
   * PRIVATE - DO NOT USE
   *
   * Initialize the router, including adding history listeners and kicking off
   * initial data fetches.  Returns a function to cleanup listeners and abort
   * any in-progress loads
   */
  initialize(): Router;

  /**
   * @internal
   * PRIVATE - DO NOT USE
   *
   * Subscribe to router.state updates
   *
   * @param fn function to call with the new state
   */
  subscribe(fn: RouterSubscriber): () => void;

  /**
   * @internal
   * PRIVATE - DO NOT USE
   *
   * Navigate forward/backward in the history stack
   * @param to Delta to move in the history stack
   */
  navigate(to: number): void;

  /**
   * Navigate to the given path
   * @param to Path to navigate to
   * @param opts Navigation options (method, submission, etc.)
   */
  navigate(to: To, opts?: RouterNavigateOptions): void;

  /**
   * @internal
   * PRIVATE - DO NOT USE
   *
   * Utility function to create an href for the given location
   * @param location
   */
  createHref(location: Location | URL): string;

  /**
   * @internal
   * PRIVATE - DO NOT USE
   *
   * Cleanup listeners and abort any in-progress loads
   */
  dispose(): void;
}

/**
 * State maintained internally by the router.  During a navigation, all states
 * reflect the the "old" location unless otherwise noted.
 */
export interface RouterState {
  /**
   * The action of the most recent navigation
   */
  historyAction: Action;

  /**
   * The current location reflected by the router
   */
  location: Location;

  /**
   * Tracks whether we've completed our initial data load
   */
  initialized: boolean;
}

/**
 * Options for a navigate() call for a Link navigation
 */
type LinkNavigateOptions = {
  replace?: boolean;
  state?: any;
};

/**
 * Options to pass to navigate() for either a Link or Form navigation
 */
export type RouterNavigateOptions = LinkNavigateOptions;
