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
	const streamRef = useRef<MediaStream | null>(null);

	useEffect(() => {
		if (typeof window !== "undefined") {
			setYear(new Date().getFullYear().toString());
		}
	}, []);

	const MAX_DURATION_SEC = 60;
	const BE_URL = "https://xajona2jla.execute-api.ap-south-1.amazonaws.com";

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

	// Create proper WAV file with PCM 16-bit encoding
	const createWavFile = (audioBuffer: AudioBuffer): Blob => {
		const length = audioBuffer.length;
		const numberOfChannels = 1; // Force mono
		const sampleRate = 16000; // 16kHz sample rate as recommended
		const bitsPerSample = 16;

		// Resample to 16kHz mono if needed
		let channelData: Float32Array;
		if (audioBuffer.numberOfChannels > 1) {
			// Mix down to mono
			const left = audioBuffer.getChannelData(0);
			const right =
				audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
			channelData = new Float32Array(length);
			for (let i = 0; i < length; i++) {
				channelData[i] = (left[i] + right[i]) / 2;
			}
		} else {
			channelData = audioBuffer.getChannelData(0);
		}

		// Resample if necessary (basic resampling)
		let finalData: Float32Array;
		if (audioBuffer.sampleRate !== sampleRate) {
			const ratio = audioBuffer.sampleRate / sampleRate;
			const newLength = Math.floor(length / ratio);
			finalData = new Float32Array(newLength);
			for (let i = 0; i < newLength; i++) {
				const srcIndex = Math.floor(i * ratio);
				finalData[i] = channelData[srcIndex];
			}
		} else {
			finalData = channelData;
		}

		const finalLength = finalData.length;
		const buffer = new ArrayBuffer(44 + finalLength * 2);
		const view = new DataView(buffer);

		// Write WAV header
		const writeString = (offset: number, string: string) => {
			for (let i = 0; i < string.length; i++) {
				view.setUint8(offset + i, string.charCodeAt(i));
			}
		};

		// RIFF chunk descriptor
		writeString(0, "RIFF");
		view.setUint32(4, 36 + finalLength * 2, true); // File size - 8
		writeString(8, "WAVE");

		// FMT sub-chunk
		writeString(12, "fmt ");
		view.setUint32(16, 16, true); // Subchunk1Size for PCM
		view.setUint16(20, 1, true); // AudioFormat (PCM = 1)
		view.setUint16(22, numberOfChannels, true); // NumChannels
		view.setUint32(24, sampleRate, true); // SampleRate
		view.setUint32(
			28,
			(sampleRate * numberOfChannels * bitsPerSample) / 8,
			true
		); // ByteRate
		view.setUint16(32, (numberOfChannels * bitsPerSample) / 8, true); // BlockAlign
		view.setUint16(34, bitsPerSample, true); // BitsPerSample

		// Data sub-chunk
		writeString(36, "data");
		view.setUint32(40, finalLength * 2, true); // Subchunk2Size

		// Convert float samples to 16-bit PCM
		let offset = 44;
		for (let i = 0; i < finalLength; i++) {
			const sample = Math.max(-1, Math.min(1, finalData[i]));
			const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(offset, pcmSample, true);
			offset += 2;
		}

		return new Blob([buffer], { type: "audio/wav" });
	};

	const handleStartRecording = async () => {
		if (!navigator.mediaDevices || !window.MediaRecorder) {
			alert("Your browser does not support voice recording.");
			return;
		}

		try {
			// Request high-quality audio stream
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: 48000, // Start with high quality, we'll downsample
					channelCount: 2, // Stereo, we'll convert to mono
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			streamRef.current = stream;

			// Use the best available format for recording
			let mimeType = "audio/webm;codecs=opus";
			if (MediaRecorder.isTypeSupported("audio/webm;codecs=pcm")) {
				mimeType = "audio/webm;codecs=pcm";
			} else if (MediaRecorder.isTypeSupported("audio/wav")) {
				mimeType = "audio/wav";
			}

			const mediaRecorder = new MediaRecorder(stream, { mimeType });
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

				try {
					// Convert to proper WAV format
					const arrayBuffer = await audioBlob.arrayBuffer();
					const audioContext = new AudioContext();
					const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

					// Create properly formatted WAV file
					const wavBlob = createWavFile(audioBuffer);
					const url = URL.createObjectURL(wavBlob);
					setAudioURL(url);

					// Close audio context to free resources
					await audioContext.close();
				} catch (error) {
					console.error("Error processing audio:", error);
					alert("Error processing audio. Please try again.");
				}

				// Stop all tracks to free the microphone
				if (streamRef.current) {
					streamRef.current.getTracks().forEach((track) => track.stop());
					streamRef.current = null;
				}
			};

			mediaRecorder.start(1000); // Collect data every second
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
		} catch (error) {
			console.error("Error starting recording:", error);
			alert(
				"Failed to start recording. Please check your microphone permissions."
			);
		}
	};

	const handleStopRecording = () => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state === "recording"
		) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
		if (timer) {
			clearInterval(timer);
			setTimer(null);
		}
		setShowCountdownNotice(false);

		// Stop all tracks to free the microphone
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}
	};

	const handleSend = async () => {
		if (!audioURL) return;
		setIsLoading(true);

		try {
			// Fetch the WAV blob
			const response = await fetch(audioURL);
			const blob = await response.blob();

			// Verify it's a WAV file
			if (!blob.type.includes("wav")) {
				throw new Error("Audio format is not WAV");
			}

			console.log(
				`Sending WAV file - Size: ${blob.size} bytes, Type: ${blob.type}`
			);

			// Convert to ArrayBuffer and then to base64
			const arrayBuffer = await blob.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);

			// Create base64 string
			let binary = "";
			const chunkSize = 0x8000; // 32KB chunks to avoid call stack issues
			for (let i = 0; i < uint8Array.length; i += chunkSize) {
				const chunk = uint8Array.subarray(i, i + chunkSize);
				binary += String.fromCharCode.apply(null, Array.from(chunk));
			}
			const base64Audio = btoa(binary);

			console.log(`Base64 encoded audio length: ${base64Audio.length}`);

			// Send to Lambda API
			const apiResponse = await axios.post(`${BE_URL}/voice`, base64Audio, {
				headers: {
					"Content-Type": "application/octet-stream",
				},
				timeout: 60000, // 60 second timeout
			});

			// Handle the audio response
			const audioBase64 = apiResponse.data.trim();
			const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
			const audio = new Audio(audioUrl);

			await audio.play();
			console.log("Response audio played successfully.");
		} catch (error) {
			console.error("Error sending voice:", error);
			if (error.response) {
				console.error("Response data:", error.response.data);
				console.error("Response status:", error.response.status);
			}
			alert("Error: Could not process your voice. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
			if (timer) {
				clearInterval(timer);
			}
		};
	}, [timer]);

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
										<source src={audioURL} type="audio/wav" />
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
