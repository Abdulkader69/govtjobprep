import { localApi } from "./local.js";
import { httpApi } from "./http.js";

const mode = import.meta.env?.VITE_API_MODE ?? "local";

/**
 * Every page talks to this object, never to fetch directly. Swapping
 * VITE_API_MODE from "local" to "http" moves grading to Laravel without
 * touching a single component.
 */
export const api = mode === "http" ? httpApi : localApi;
export const apiMode = mode;
