import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { HomePage } from "../pages/HomePage";
import { BlocksPage } from "../pages/BlocksPage";
import { CircuitsPage } from "../pages/CircuitsPage";
import { MiningPage } from "../pages/MiningPage";
import { SearchPage } from "../pages/SearchPage";
import { DetailsPage } from "../pages/DetailsPage";
import { NotFoundPage } from "../pages/NotFoundPage";
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/blocks", element: <BlocksPage /> },
      { path: "/circuits", element: <CircuitsPage /> },
      { path: "/mining", element: <MiningPage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/blocks/:id", element: <DetailsPage kind="blocks" /> },
      { path: "/block/:id", element: <DetailsPage kind="blocks" /> },
      { path: "/circuits/:id", element: <DetailsPage kind="circuits" /> },
      { path: "/circuit/:id", element: <DetailsPage kind="circuits" /> },
      { path: "/addresses/:id", element: <DetailsPage kind="addresses" /> },
      { path: "/address/:id", element: <DetailsPage kind="addresses" /> },
      {
        path: "/transactions/:id",
        element: <DetailsPage kind="transactions" />,
      },
      { path: "/tx/:id", element: <DetailsPage kind="transactions" /> },
      { path: "/tx/coin/:id", element: <DetailsPage kind="transactions" /> },
      { path: "/proof/:id", element: <DetailsPage kind="proofs" /> },
      { path: "/tx/proof/:id", element: <DetailsPage kind="proofs" /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
