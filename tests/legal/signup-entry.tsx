import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import Auth from "@/pages/Auth";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Auth />
  </BrowserRouter>,
);
