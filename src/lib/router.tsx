import React, {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

interface LocationState {
  pathname: string;
  search: string;
  hash: string;
}

interface RouterContextValue {
  location: LocationState;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

interface RouterProps {
  children: ReactNode;
  future?: unknown;
}

interface MemoryRouterProps extends RouterProps {
  initialEntries?: string[];
}

interface RouteProps {
  path: string;
  element: ReactNode;
}

const RouterContext = createContext<RouterContextValue | null>(null);

const parsePath = (value: string): LocationState => {
  const url = new URL(value || "/", "http://focus-flow.local");
  return {
    pathname: url.pathname || "/",
    search: url.search,
    hash: url.hash,
  };
};

const browserLocation = (): LocationState => ({
  pathname: window.location.pathname || "/",
  search: window.location.search,
  hash: window.location.hash,
});

const hashLocation = (): LocationState => {
  const hashPath = window.location.hash.replace(/^#/, "") || "/";
  return parsePath(hashPath.startsWith("/") ? hashPath : `/${hashPath}`);
};

const pathWithSearch = (location: LocationState) =>
  `${location.pathname}${location.search}${location.hash}`;

const RouterProvider = ({
  children,
  location,
  navigate,
}: {
  children: ReactNode;
  location: LocationState;
  navigate: RouterContextValue["navigate"];
}) => {
  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const BrowserRouter = ({ children }: RouterProps) => {
  const [location, setLocation] = useState(browserLocation);

  useEffect(() => {
    const handlePopState = () => setLocation(browserLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const next = parsePath(to);
    const nextPath = pathWithSearch(next);
    if (options?.replace) window.history.replaceState(null, "", nextPath);
    else window.history.pushState(null, "", nextPath);
    setLocation(browserLocation());
  }, []);

  return <RouterProvider location={location} navigate={navigate}>{children}</RouterProvider>;
};

export const HashRouter = ({ children }: RouterProps) => {
  const [location, setLocation] = useState(hashLocation);

  useEffect(() => {
    const handleHashChange = () => setLocation(hashLocation());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const next = parsePath(to);
    const nextHash = `#${pathWithSearch(next)}`;
    if (options?.replace) window.location.replace(nextHash);
    else window.location.hash = nextHash;
    setLocation(next);
  }, []);

  return <RouterProvider location={location} navigate={navigate}>{children}</RouterProvider>;
};

export const MemoryRouter = ({ children, initialEntries }: MemoryRouterProps) => {
  const [location, setLocation] = useState(() => parsePath(initialEntries?.[0] || "/"));

  const navigate = useCallback((to: string) => {
    setLocation(parsePath(to));
  }, []);

  return <RouterProvider location={location} navigate={navigate}>{children}</RouterProvider>;
};

export const Route = (_props: RouteProps) => null;

export const Routes = ({ children }: { children: ReactNode }) => {
  const { location } = useRouterContext();
  const routes = React.Children.toArray(children).filter(isValidElement) as ReactElement<RouteProps>[];
  const match = routes.find((route) => route.props.path === location.pathname)
    || routes.find((route) => route.props.path === "*");
  return <>{match?.props.element || null}</>;
};

export const useNavigate = () => useRouterContext().navigate;

export const useLocation = () => useRouterContext().location;

export const useSearchParams = (): [
  URLSearchParams,
  (nextInit: URLSearchParams | Record<string, string> | string, options?: { replace?: boolean }) => void,
] => {
  const { location, navigate } = useRouterContext();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const setSearchParams = useCallback((nextInit: URLSearchParams | Record<string, string> | string, options?: { replace?: boolean }) => {
    const next = nextInit instanceof URLSearchParams
      ? nextInit
      : new URLSearchParams(nextInit);
    const search = next.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, options);
  }, [location.hash, location.pathname, navigate]);

  return [searchParams, setSearchParams];
};

const useRouterContext = () => {
  const context = useContext(RouterContext);
  if (!context) throw new Error("Router hooks must be used inside a router");
  return context;
};
