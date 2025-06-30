"use client";

import { SUPPORTED_LANGUAGES } from "@/lib/constants";
import { motion } from "framer-motion";

export default function SupportedLanguagesGrid() {
	return (
		<div className="w-full max-w-4xl mx-auto mt-16 px-4">
			<h2 className="text-center text-lg font-semibold mb-4 text-muted-foreground">
				🌍 Languages VoiceNest Can Speak
			</h2>

			<motion.div
				initial="hidden"
				animate="visible"
				variants={{
					hidden: { opacity: 0, y: 20 },
					visible: {
						opacity: 1,
						y: 0,
						transition: {
							delayChildren: 0.2,
							staggerChildren: 0.03,
						},
					},
				}}
				className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-2 border border-border rounded-xl bg-muted/40 shadow-inner">
				{SUPPORTED_LANGUAGES.map((lang, idx) => (
					<motion.div
						key={idx}
						variants={{
							hidden: { opacity: 0, y: 10 },
							visible: { opacity: 1, y: 0 },
						}}
						className="px-3 py-2 text-sm text-muted-foreground bg-background rounded-lg border border-border shadow-sm"
						title={lang.label}>
						🌐 {lang.label}
					</motion.div>
				))}
			</motion.div>
		</div>
	);
}
