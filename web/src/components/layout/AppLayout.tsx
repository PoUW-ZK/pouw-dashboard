import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { SearchBar } from "../../features/search/SearchBar";
export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="app-shell">
      <header>
        <Link to="/" className="brand">
          PoUW Explorer
        </Link>
        <nav aria-label="Main navigation">
          {[
            ["/", "Home"],
            ["/blocks", "Blocks"],
            ["/circuits", "Circuits"],
            ["/mining", "Mining"],
          ].map(([to, label]) => (
            <NavLink key={to} end={to === "/"} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
        {pathname !== "/" && pathname !== "/search" && <SearchBar compact />}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
