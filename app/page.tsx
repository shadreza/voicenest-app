"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Clock3, Loader2, Mic, Repeat, Send } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_DURATION_SEC = 60; // 5 minutes

export default function AudioRecorder() {
	const [isRecording, setIsRecording] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isInitialized, setIsInitialized] = useState(false);
	const [audioURL, setAudioURL] = useState(null);
	const [audioBlob, setAudioBlob] = useState(null);
	const [recordingTime, setRecordingTime] = useState(0);
	const [showCountdownNotice, setShowCountdownNotice] = useState(false);

	const mediaRecorderRef = useRef(null);
	const audioChunksRef = useRef([]);
	const timerRef = useRef(null);
	const streamRef = useRef(null);

	const year = new Date().getFullYear();

	// Format duration helper
	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Initialize audio recorder
	const initializeRecorder = useCallback(async () => {
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

	// Start recording
	const handleStartRecording = useCallback(async () => {
		if (!streamRef.current) {
			await initializeRecorder();
			return;
		}

		try {
			audioChunksRef.current = [];

			const mediaRecorder = new MediaRecorder(streamRef.current, {
				mimeType: "audio/webm;codecs=opus", // Fallback to WAV conversion
			});

			mediaRecorderRef.current = mediaRecorder;

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: "audio/webm;codecs=opus",
				});

				// Convert to WAV format
				const wavBlob = await convertToWav(audioBlob);
				setAudioBlob(wavBlob);
				setAudioURL(URL.createObjectURL(wavBlob));
			};

			mediaRecorder.start(100); // Collect data every 100ms
			setIsRecording(true);
			setRecordingTime(0);

			// Start timer
			timerRef.current = setInterval(() => {
				setRecordingTime((prev) => {
					const newTime = prev + 1;

					// Show countdown notice in last 10 seconds
					if (newTime >= MAX_DURATION_SEC - 10 && newTime < MAX_DURATION_SEC) {
						setShowCountdownNotice(true);
					}

					// Auto-stop at max duration
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Stop recording
	const handleStopRecording = useCallback(() => {
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

	// Convert WebM to WAV format
	const convertToWav = async (webmBlob: unknown) => {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = async () => {
				try {
					const audioContext = new (window.AudioContext ||
						window.webkitAudioContext)();
					const audioBuffer = await audioContext.decodeAudioData(reader.result);

					// Convert to WAV
					const wavBuffer = audioBufferToWav(audioBuffer);
					const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
					resolve(wavBlob);
				} catch (error) {
					console.error("WAV conversion failed, using original:", error);
					resolve(webmBlob); // Fallback to original
				}
			};
			reader.readAsArrayBuffer(webmBlob);
		});
	};

	// Convert AudioBuffer to WAV format
	const audioBufferToWav = (buffer: AudioBuffer) => {
		const length = buffer.length;
		const numberOfChannels = buffer.numberOfChannels;
		const sampleRate = buffer.sampleRate;
		const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
		const view = new DataView(arrayBuffer);

		// WAV header
		const writeString = (offset: number, string: string) => {
			for (let i = 0; i < string.length; i++) {
				view.setUint8(offset + i, string.charCodeAt(i));
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

		// Convert audio data
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

	// Retry recording
	const handleRetry = () => {
		setAudioURL(null);
		setAudioBlob(null);
		setRecordingTime(0);
		setShowCountdownNotice(false);
	};

	// Send audio to API
	const handleSend = async () => {
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

			console.log("response : ", response);

			if (response.ok) {
				// Check if the response is audio (MP3)
				const contentType = response.headers.get("content-type");

				if (contentType && contentType.includes("audio/mpeg")) {
					// Handle audio response
					const audioBlob = await response.blob();

					// Create audio URL and play it
					const audioUrl = URL.createObjectURL(audioBlob);
					const audio = new Audio(audioUrl);

					// Play the audio
					audio
						.play()
						.then(() => {
							console.log("Audio playback started");
							alert("Voice response received and playing!");
						})
						.catch((error) => {
							console.error("Error playing audio:", error);
							alert("Received audio but couldn't play it");
						});

					// Optional: Clean up the URL after audio ends
					audio.addEventListener("ended", () => {
						URL.revokeObjectURL(audioUrl);
					});
				} else {
					// Handle JSON response (in case your API sometimes returns JSON)
					const result = await response.json();
					console.log("Upload successful:", result);
					alert("Voice sent successfully!");
				}

				handleRetry(); // Reset for new recording
			} else {
				throw new Error(`Upload failed with status: ${response.status}`);
			}
		} catch (error) {
			console.error("Failed to send audio:", error);
			alert("Failed to send voice. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	// Initialize on component mount
	useEffect(() => {
		initializeRecorder();

		return () => {
			// Cleanup
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
			if (streamRef.current) {
				streamRef.current
					.getTracks()
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					.forEach((track: { stop: () => any }) => track.stop());
			}
			if (audioURL) {
				URL.revokeObjectURL(audioURL);
			}
		};
	}, [audioURL, initializeRecorder]);

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

				{!isInitialized && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="bg-yellow-100 text-yellow-800 p-3 rounded-xl flex items-center justify-center gap-2 font-medium">
						<Loader2 size={16} className="animate-spin" />
						Initializing recorder...
					</motion.div>
				)}

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
										<source
											src={audioURL}
											type={audioBlob?.type || "audio/wav"}
										/>
										Your browser does not support the audio element.
									</audio>
								</motion.div>
							)
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
								disabled={!isInitialized}
								size="lg"
								className="text-lg px-6 py-3 rounded-2xl shadow-md flex gap-2 items-center">
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
								disabled={!audioBlob || isLoading || !isInitialized}
								variant="secondary"
								size="lg"
								className="text-lg px-6 py-3 rounded-2xl flex gap-2 items-center">
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
