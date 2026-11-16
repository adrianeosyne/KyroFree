import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { botHttp } from "./botHttp";
import { feedHttp } from "./lobby";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/api/lobby-feed", method: "POST", handler: feedHttp });
for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"] as const) {
  http.route({ pathPrefix: "/api/bots/v1/", method, handler: botHttp });
}

export default http;
