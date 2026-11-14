import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { botHttp } from "./botHttp";
import { downloadFile } from "./fileHttp";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/files/download", method: "GET", handler: downloadFile });
for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"] as const) {
  http.route({ pathPrefix: "/api/bots/v1/", method, handler: botHttp });
  http.route({ pathPrefix: "/api/v1/", method, handler: botHttp });
}

export default http;
