import * as faceapi from "face-api.js";
import { useEffect, useRef, useState } from "react";
import { EXPRESSION_EMOJIS } from "./-constants";
import FloatingEmoji from "./-floating-emoji";

// RemoteVideo component to display other participants' streams
export function RemoteVideo({
	stream,
	participant,
}: Readonly<{
	stream: MediaStream;
	participant: any;
}>) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [floatingEmojis, setFloatingEmojis] = useState<
		Array<{
			id: string;
			emoji: string;
			x: number;
			y: number;
		}>
	>([]);
	const [modelsLoaded, setModelsLoaded] = useState(false);

	// Load face-api models
	useEffect(() => {
		const loadModels = async () => {
			try {
				const MODEL_URL =
					"https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
				await Promise.all([
					faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
					faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
				]);
				setModelsLoaded(true);
			} catch (error) {
				console.error("Failed to load face-api models:", error);
			}
		};
		loadModels();
	}, []);

	useEffect(() => {
		const video = videoRef.current;
		if (video) {
			video.srcObject = stream;
			video
				.play()
				.catch((err) => console.error("Play remote video failed:", err));
		}
	}, [stream]);

	// Expression detection for remote video
	useEffect(() => {
		if (!modelsLoaded || !videoRef.current) return;

		const video = videoRef.current;
		const canvas = canvasRef.current;
		if (!canvas) return;

		const detectExpressions = async () => {
			if (video.readyState === 4) {
				try {
					const detections = await faceapi
						.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
						.withFaceExpressions();

					if (detections.length > 0) {
						const expressions = detections[0].expressions;
						const dominantExpression = Object.keys(expressions).reduce(
							(a, b) =>
								expressions[a as keyof typeof expressions] >
								expressions[b as keyof typeof expressions]
									? a
									: b,
						) as keyof typeof EXPRESSION_EMOJIS;

						// Only show emoji if confidence is high enough
						if (expressions[dominantExpression] > 0.7) {
							const emoji = EXPRESSION_EMOJIS[dominantExpression];
							const newEmoji = {
								id: Date.now().toString(),
								emoji,
								x: Math.random() * 80 + 10, // Random position
								y: Math.random() * 80 + 10,
							};

							setFloatingEmojis((prev) => [...prev, newEmoji]);

							// Remove emoji after 2 seconds
							setTimeout(() => {
								setFloatingEmojis((prev) =>
									prev.filter((e) => e.id !== newEmoji.id),
								);
							}, 2000);
						}
					}
				} catch (error) {
					console.error("Expression detection error:", error);
				}
			}
		};

		const interval = setInterval(detectExpressions, 1000); // Check every second
		return () => clearInterval(interval);
	}, [modelsLoaded]);

	return (
		<div className="relative w-full h-full">
			{/* biome-ignore lint/a11y/useMediaCaption: <explanation> */}
			<video
				ref={videoRef}
				autoPlay
				playsInline
				className="w-full h-full object-cover"
			/>
			<canvas
				ref={canvasRef}
				className="absolute top-0 left-0 w-full h-full pointer-events-none"
				style={{ display: "none" }}
			/>
			{floatingEmojis.map((emoji) => (
				<FloatingEmoji
					key={emoji.id}
					emoji={emoji.emoji}
					x={emoji.x}
					y={emoji.y}
					id={emoji.id}
				/>
			))}
			<div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-sm">
				{participant.user?.name || "Remote User"}
			</div>
		</div>
	);
}
