"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Clock3, Loader2, Mic, Repeat, Send } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function Home() {
	const [isRecording, setIsRecording] = useState(false);
	const [audioURL, setAudioURL] = useState<string | null>(null);
	const [recordingTime, setRecordingTime] = useState(0);
	const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
	const [showCountdownNotice, setShowCountdownNotice] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [year, setYear] = useState("");
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			setYear(new Date().getFullYear().toString());
		}
	}, []);

	const MAX_DURATION_SEC = 60;
	const BE_URL = "https://your-api-gateway-url";

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		if (mins > 0) {
			return `${mins} min${mins > 1 ? "s" : ""}${
				secs > 0 ? ` ${secs} sec` : ""
			}`;
		}
		return `${secs} seconds`;
	};

	const handleStartRecording = async () => {
		if (!navigator.mediaDevices || !window.MediaRecorder) {
			alert("Your browser does not support voice recording.");
			return;
		}

		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const mediaRecorder = new MediaRecorder(stream);
		mediaRecorderRef.current = mediaRecorder;
		audioChunksRef.current = [];

		mediaRecorder.ondataavailable = (event) => {
			audioChunksRef.current.push(event.data);
		};

		mediaRecorder.onstop = () => {
			const audioBlob = new Blob(audioChunksRef.current, {
				type: "audio/webm",
			});
			const url = URL.createObjectURL(audioBlob);
			setAudioURL(url);
		};

		mediaRecorder.start();
		setIsRecording(true);
		setRecordingTime(0);
		setShowCountdownNotice(false);
		const t = setInterval(() => {
			setRecordingTime((prev) => {
				if (prev >= MAX_DURATION_SEC) {
					handleStopRecording();
					return prev;
				}
				if (prev === MAX_DURATION_SEC - 10) {
					setShowCountdownNotice(true);
				}
				return prev + 1;
			});
		}, 1000);
		setTimer(t);
	};

	const handleStopRecording = () => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state === "recording"
		) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
		if (timer) clearInterval(timer);
		setShowCountdownNotice(false);
	};

	const handleSend = async () => {
		if (!audioURL) return;
		setIsLoading(true);
		try {
			const data = new FormData();
			const res = await fetch(audioURL);
			const blob = await res.blob();
			data.append("audio", blob, "recording.webm");

			const response = await axios.post(BE_URL, data);
			console.log("Response:", response.data);
			alert("Your voice has been sent.");
		} catch (error) {
			console.error("Error sending message:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-6 sm:p-12 font-sans bg-[#fefcf8]">
			<main className="flex flex-col gap-6 items-center w-full max-w-2xl text-center">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}>
					<Image
						className="dark:invert mb-10"
						src="/voicenest-logo.png"
						alt="VoiceNest logo"
						width={40}
						height={40}
						priority
					/>
				</motion.div>

				<motion.h1
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.3 }}
					className="text-3xl sm:text-4xl font-bold text-[#2c2c2c] tracking-tight">
					Speak Your Heart
				</motion.h1>
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.5 }}
					className="text-lg text-muted-foreground">
					Tap to record your voice. Let your feelings be heard.
				</motion.p>
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.7 }}
					className="text-muted-foreground">
					Maximum recording time: {formatDuration(MAX_DURATION_SEC)}
				</motion.p>

				<Card className="w-full mt-10">
					<CardContent className="p-4 sm:p-6 space-y-4">
						<AnimatePresence>
							{showCountdownNotice && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="bg-red-100 text-red-800 p-3 rounded-xl flex items-center justify-center gap-2 font-semibold">
									<AlertCircle size={20} /> Last 10 seconds remaining!
								</motion.div>
							)}
						</AnimatePresence>

						{isLoading ? (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								className="flex flex-col items-center justify-center text-center space-y-2 py-6 animate-pulse text-muted-foreground">
								<Loader2 size={24} className="animate-spin" />
								<p className="text-base font-medium">
									Please wait, your voice is being heard...
								</p>
							</motion.div>
						) : (
							audioURL && (
								<motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className="w-full">
									<audio controls className="w-full">
										<source src={audioURL} type="audio/webm" />
										Your browser does not support the audio element.
									</audio>
								</motion.div>
							)
						)}

						<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
							<Button
								onClick={
									isRecording ? handleStopRecording : handleStartRecording
								}
								variant="default"
								className="text-lg px-6 py-3 rounded-2xl shadow-md flex gap-2 items-center cursor-pointer">
								{isRecording ? (
									<>
										<Clock3 size={18} /> Stop ({recordingTime}s)
									</>
								) : audioURL ? (
									<>
										<Repeat size={18} /> Retry
									</>
								) : (
									<>
										<Mic size={18} /> Start Talking
									</>
								)}
							</Button>

							<Button
								onClick={handleSend}
								disabled={!audioURL || isLoading}
								variant="secondary"
								className="text-lg px-6 py-3 rounded-2xl flex gap-2 items-center cursor-pointer">
								<Send size={18} /> Send Voice
							</Button>
						</div>
					</CardContent>
				</Card>
			</main>

			<footer className="mt-12 text-sm text-muted-foreground text-center">
				VoiceNest © {year} — Made with empathy.
			</footer>
		</div>
	);
}
