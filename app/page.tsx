"use client";

import SupportedLanguagesTicker from "@/components/SupportedLanguagesTicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LANGUAGE_CODE_TO_LABEL_MAP } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Clock3, Loader2, Mic, Repeat, Send } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_DURATION_SEC = 60;

export default function AudioRecorder() {
	const [isRecording, setIsRecording] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isInitialized, setIsInitialized] = useState(false);
	const [audioURL, setAudioURL] = useState<string | null>(null);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [recordingTime, setRecordingTime] = useState(0);
	const [showCountdownNotice, setShowCountdownNotice] = useState(false);

	const [responseAudioURL, setResponseAudioURL] = useState<string | null>(null);
	const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const userAudioRef = useRef<HTMLAudioElement | null>(null);
	const responseAudioRef = useRef<HTMLAudioElement | null>(null);

	const year = new Date().getFullYear();

	const formatDuration = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;

		if (secs === 0) {
			return `${mins} min`;
		}
		return `${mins} min ${secs} sec`;
	};

	const initializeRecorder = useCallback(async (): Promise<void> => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					sampleRate: 44100,
				},
			});
			streamRef.current = stream;
			setIsInitialized(true);
		} catch (error) {
			console.error("Failed to initialize audio recorder:", error);
			alert("Microphone access is required for voice recording.");
		}
	}, []);

	const handleStopRecording = useCallback((): void => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
			setShowCountdownNotice(false);
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
		}
	}, [isRecording]);

	useEffect(() => {
		if (recordingTime >= MAX_DURATION_SEC) handleStopRecording();
	}, [recordingTime, handleStopRecording]);

	const handleStartRecording = useCallback(async (): Promise<void> => {
		if (!streamRef.current) {
			await initializeRecorder();
			return;
		}

		try {
			audioChunksRef.current = [];

			const mediaRecorder = new MediaRecorder(streamRef.current, {
				mimeType: "audio/webm;codecs=opus",
			});
			mediaRecorderRef.current = mediaRecorder;

			mediaRecorder.ondataavailable = (event: BlobEvent): void => {
				if (event.data.size > 0) audioChunksRef.current.push(event.data);
			};

			mediaRecorder.onstop = async (): Promise<void> => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: "audio/webm;codecs=opus",
				});
				const wavBlob = await convertToWav(audioBlob);
				setAudioBlob(wavBlob);
				setAudioURL(URL.createObjectURL(wavBlob));
			};

			mediaRecorder.start(100);
			setIsRecording(true);
			setRecordingTime(0);

			timerRef.current = setInterval(() => {
				setRecordingTime((prev) => {
					const newTime = prev + 1;
					if (newTime >= MAX_DURATION_SEC - 10 && newTime < MAX_DURATION_SEC)
						setShowCountdownNotice(true);
					if (newTime >= MAX_DURATION_SEC) {
						handleStopRecording();
						return MAX_DURATION_SEC;
					}
					return newTime;
				});
			}, 1000);
		} catch (error) {
			console.error("Failed to start recording:", error);
		}
	}, [initializeRecorder, handleStopRecording]);

	const convertToWav = async (webmBlob: Blob): Promise<Blob> => {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = async () => {
				try {
					const arrayBuffer = reader.result as ArrayBuffer;
					const AudioContextClass: typeof AudioContext =
						window.AudioContext ||
						(
							window as typeof window & {
								webkitAudioContext: typeof AudioContext;
							}
						).webkitAudioContext;
					const audioContext = new AudioContextClass();
					const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
					const wavBuffer = audioBufferToWav(audioBuffer);
					resolve(new Blob([wavBuffer], { type: "audio/wav" }));
				} catch (error) {
					console.error("WAV conversion failed:", error);
					resolve(webmBlob);
				}
			};
			reader.readAsArrayBuffer(webmBlob);
		});
	};

	const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
		const length = buffer.length;
		const numberOfChannels = buffer.numberOfChannels;
		const sampleRate = buffer.sampleRate;
		const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
		const view = new DataView(arrayBuffer);

		const writeString = (offset: number, str: string): void => {
			for (let i = 0; i < str.length; i++) {
				view.setUint8(offset + i, str.charCodeAt(i));
			}
		};

		writeString(0, "RIFF");
		view.setUint32(4, 36 + length * numberOfChannels * 2, true);
		writeString(8, "WAVE");
		writeString(12, "fmt ");
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, numberOfChannels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * numberOfChannels * 2, true);
		view.setUint16(32, numberOfChannels * 2, true);
		view.setUint16(34, 16, true);
		writeString(36, "data");
		view.setUint32(40, length * numberOfChannels * 2, true);

		let offset = 44;
		for (let i = 0; i < length; i++) {
			for (let channel = 0; channel < numberOfChannels; channel++) {
				const sample = Math.max(
					-1,
					Math.min(1, buffer.getChannelData(channel)[i])
				);
				view.setInt16(offset, sample * 0x7fff, true);
				offset += 2;
			}
		}

		return arrayBuffer;
	};

	const handleRetry = (): void => {
		setAudioURL(null);
		setAudioBlob(null);
		setResponseAudioURL(null);
		setDetectedLanguage(null);
		setRecordingTime(0);
		setShowCountdownNotice(false);
	};

	const handleSend = async (): Promise<void> => {
		if (!audioBlob) return;
		setIsLoading(true);

		try {
			const formData = new FormData();
			formData.append("audio", audioBlob, "recording.wav");

			const API_URL = "https://xajona2jla.execute-api.ap-south-1.amazonaws.com";
			const response = await fetch(`${API_URL}/voice`, {
				method: "POST",
				body: formData,
			});

			if (
				response.ok &&
				response.headers.get("Content-Type")?.includes("audio/mpeg")
			) {
				const arrayBuffer = await response.arrayBuffer();
				const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
				const url = URL.createObjectURL(blob);
				setResponseAudioURL(url);

				const langHeader = response.headers.get("x-language");

				if (langHeader)
					setDetectedLanguage(LANGUAGE_CODE_TO_LABEL_MAP[langHeader]);

				setTimeout(() => {
					if (responseAudioRef.current) {
						responseAudioRef.current.play().catch((err) => {
							console.warn("Autoplay failed:", err);
						});
					}
				}, 100);
			} else {
				const result = await response.json();
				alert("Voice sent successfully!");
				console.log("Response:", result);
			}
		} catch (error) {
			console.error("Failed to send audio:", error);
			alert("Failed to send voice. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleUserPlay = () => {
		if (responseAudioRef.current) responseAudioRef.current.pause();
	};
	const handleResponsePlay = () => {
		if (userAudioRef.current) userAudioRef.current.pause();
	};

	useEffect(() => {
		initializeRecorder();
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (streamRef.current)
				streamRef.current.getTracks().forEach((t) => t.stop());
			if (audioURL) URL.revokeObjectURL(audioURL);
		};
	}, [audioURL, initializeRecorder]);

	return (
		<div className="relative grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-6 sm:p-12 font-sans bg-[#faf9f7] text-gray-800">
			<main className="flex flex-col gap-6 items-center w-full max-w-2xl text-center z-10">
				<Image
					className="dark:invert mb-10"
					src="/voicenest-logo.png"
					alt="VoiceNest logo"
					width={40}
					height={40}
					priority
				/>
				<h1 className="text-3xl sm:text-4xl font-extrabold text-[#1a1a1a] tracking-tight">
					Speak Your Heart
				</h1>
				<p className="text-lg text-gray-600">
					Tap to record your voice. Let your feelings be heard.
				</p>
				<p className="text-gray-500">
					Maximum recording time: {formatDuration(MAX_DURATION_SEC)}
				</p>

				{!isInitialized && (
					<div className="bg-yellow-100 text-yellow-900 p-3 rounded-xl flex items-center justify-center gap-2 font-semibold shadow-md">
						<Loader2 size={16} className="animate-spin" /> Initializing
						recorder...
					</div>
				)}

				{/* Localized Loading Overlay Wrapper */}
				<div className="relative w-full mt-10">
					<AnimatePresence>
						{isLoading && (
							<motion.div
								key="loading-overlay"
								initial={{ opacity: 0 }}
								animate={{ opacity: 0.5 }}
								exit={{ opacity: 0 }}
								className="absolute inset-0 bg-black z-20 flex flex-col items-center justify-center gap-4 rounded-xl">
								<Loader2 size={36} className="animate-spin text-white" />
								<p className="text-white text-sm font-semibold">
									Processing your voice...
								</p>
							</motion.div>
						)}
					</AnimatePresence>

					<Card className="w-full shadow-lg border border-gray-200 relative z-10">
						<CardContent className="p-6 space-y-5">
							<AnimatePresence>
								{showCountdownNotice && (
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="bg-red-100 text-red-900 p-3 rounded-xl flex items-center justify-center gap-2 font-semibold shadow-sm">
										<AlertCircle size={20} />
										{`${MAX_DURATION_SEC - recordingTime} seconds remaining`}
									</motion.div>
								)}
							</AnimatePresence>

							{audioURL && (
								<div className="space-y-3">
									<p className="text-sm font-bold text-gray-700 text-left">
										Your voice
									</p>
									<audio
										ref={userAudioRef}
										onPlay={handleUserPlay}
										controls
										className="w-full rounded-md">
										<source src={audioURL} />
									</audio>
								</div>
							)}

							{responseAudioURL && (
								<div className="space-y-3 mt-8">
									<p className="text-sm font-bold text-gray-700 text-right">
										Response
									</p>
									<audio
										ref={responseAudioRef}
										onPlay={handleResponsePlay}
										controls
										className="w-full rounded-md">
										<source src={responseAudioURL} />
									</audio>
								</div>
							)}

							{detectedLanguage && (
								<p className="text-sm italic text-gray-600 mt-2">
									Detected language: <strong>{detectedLanguage}</strong>
								</p>
							)}

							<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
								<Button
									onClick={
										isRecording
											? handleStopRecording
											: audioURL
											? handleRetry
											: handleStartRecording
									}
									disabled={!isInitialized || isLoading}
									size="lg"
									className="text-lg px-6 py-3 rounded-2xl shadow-md flex gap-2 items-center cursor-pointer">
									{isRecording ? (
										<>
											<Clock3 size={18} /> Stop ({recordingTime}s)
										</>
									) : audioURL ? (
										<>
											<Repeat size={18} /> Record Again
										</>
									) : (
										<>
											<Mic size={18} /> Start Talking
										</>
									)}
								</Button>

								<Button
									onClick={handleSend}
									disabled={
										!audioBlob ||
										isLoading ||
										!isInitialized ||
										responseAudioURL
									}
									size="lg"
									className={`text-lg px-6 py-3 rounded-2xl flex gap-2 items-center cursor-pointer
									${
										audioBlob && !isLoading && !responseAudioURL
											? "bg-green-600 text-white shadow-lg animate-pulse"
											: ""
									}
								`}>
									<Send size={18} /> Send Voice
								</Button>
							</div>

							{(audioURL || responseAudioURL) && (
								<Button
									onClick={handleRetry}
									variant="outline"
									disabled={isLoading || !responseAudioURL}
									className="mt-4 text-sm cursor-pointer">
									Talk More
								</Button>
							)}
						</CardContent>
					</Card>
				</div>
			</main>

			<SupportedLanguagesTicker />
			<footer className="mt-12 text-sm text-gray-500 text-center">
				VoiceNest © {year} — Made with empathy.
			</footer>
		</div>
	);
}
