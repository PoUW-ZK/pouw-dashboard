import { Link, NavLink, Outlet } from "react-router-dom";
import { showPouw } from "../../lib/config";
import { LiveStatus } from "./LiveStatus";
export function AppLayout() {
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
            ...(showPouw ? [["/circuits", "Circuits"]] : []),
            ["/mining", "Mining"],
          ].map(([to, label]) => (
            <NavLink key={to} end={to === "/"} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <LiveStatus />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
