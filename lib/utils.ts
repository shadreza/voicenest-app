import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SUPPORTED_LANGUAGES } from "./constants";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const LANGUAGE_CODE_TO_LABEL_MAP = Object.fromEntries(
	SUPPORTED_LANGUAGES.map(({ code, label }) => [code, label])
);
