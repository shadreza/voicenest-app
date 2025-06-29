"use client";

import { SUPPORTED_LANGUAGES } from "@/lib/constants";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export default function SupportedLanguagesTicker() {
	const containerRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		if (containerRef.current) {
			setWidth(containerRef.current.scrollWidth / 2);
		}
	}, []);

	return (
		<div className="overflow-hidden w-full max-w-lg mx-auto mt-4">
			<motion.div
				ref={containerRef}
				className="flex gap-6 text-sm text-muted-foreground font-medium whitespace-nowrap"
				animate={{ x: [-0, -width] }}
				transition={{
					repeat: Infinity,
					duration: 30,
					ease: "linear",
				}}>
				{[...SUPPORTED_LANGUAGES, ...SUPPORTED_LANGUAGES].map((lang, idx) => (
					<div
						key={idx}
						className="px-3 py-1 bg-muted rounded-xl border border-border"
						title={lang.label}>
						🌍 {lang.label}
					</div>
				))}
			</motion.div>
		</div>
	);
}
