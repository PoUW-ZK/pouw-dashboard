import { Link } from "react-router-dom";
import { PageTitle } from "./PageTitle";
export function NotFoundPage() {
  return (
    <div className="page">
      <PageTitle
        title="Page not found"
        description="This page is outside the chain."
      />
      <Link className="view-all" to="/">
        Return home →
      </Link>
    </div>
  );
}
