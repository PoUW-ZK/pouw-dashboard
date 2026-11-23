import { createServer } from "vite";
import react from "@vitejs/plugin-react";

export function testServer(pouw = false, mocks = true, dev = true) {
  return createServer({
    configFile: false,
    envDir: false,
    appType: "custom",
    plugins: [react()],
    define: {
      "import.meta.env.DEV": JSON.stringify(dev),
      "import.meta.env.VITE_USE_MOCKS": JSON.stringify(String(mocks)),
      "import.meta.env.VITE_SHOW_POUW": JSON.stringify(String(pouw)),
    },
    server: { middlewareMode: true, ws: false, watch: null },
  });
}
