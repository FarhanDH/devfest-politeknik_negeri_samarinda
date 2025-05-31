import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import * as faceapi from "face-api.js";
import Peer from "peerjs";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Emoji mapping for expressions
const EXPRESSION_EMOJIS = {
	happy: "😊",
	sad: "😢",
	angry: "😠",
	fearful: "😨",
	disgusted: "🤢",
	surprised: "😲",
	neutral: "😐",
};

// Floating emoji component
function FloatingEmoji({
	emoji,
	x,
	y,
	id,
}: { emoji: string; x: number; y: number; id: string }) {
	return (
		<div
			key={id}
			className="absolute text-2xl animate-bounce pointer-events-none z-10"
			style={{
				left: `${x}%`,
				top: `${y}%`,
				animation: "float 2s ease-out forwards",
			}}
		>
			{emoji}
		</div>
	);
}

/**
 * RemoteVideo component to display other participants' streams
 * @param {{ stream: MediaStream, participant: any }} props
 * @prop {MediaStream} stream The media stream from the remote user
 * @prop {any} participant The user object from the Convex database
 */

export function RemoteVideo({
	stream,
	participant,
}: {
	// The media stream from the remote user
	stream: MediaStream;
	// The user object from the Convex database
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	participant: any;
}) {
	// A reference to the video element so we can control it
	const videoRef = useRef<HTMLVideoElement>(null);
	// A reference to the canvas element so we can draw on it
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// A state variable to keep track of all the floating emojis we should show
	const [floatingEmojis, setFloatingEmojis] = useState<
		Array<{
			id: string;
			emoji: string;
			x: number;
			y: number;
		}>
	>([]);
	// A state variable to keep track of whether the face-api models have been loaded
	const [modelsLoaded, setModelsLoaded] = useState(false);
	const [videoWidth, setVideoWidth] = useState(640);
	const [videoHeight, setVideoHeight] = useState(480);

	// Load face-api models when the component mounts
	useEffect(() => {
		const loadModels = async () => {
			// Try to load the face-api models from a GitHub URL
			try {
				const MODEL_URL = "/models";
				await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
				await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

				// If the models load successfully, set the state variable to true
				setModelsLoaded(true);
			} catch (error) {
				// If there's an error, log it to the console
				console.error("Failed to load face-api models:", error);
			}
		};
		// Call the function to load the models
		loadModels();
	}, []);

	// Set up the video element to play the remote video stream
	useEffect(() => {
		const video = videoRef.current;
		if (video) {
			// Set the source of the video element to the remote stream
			video.srcObject = stream;
			// Play the video
			video
				.play()
				.catch((err) => console.error("Play remote video failed:", err));
		}
	}, [stream]);

	// Detect expressions in the remote video stream
	useEffect(() => {
		// Only do this if the models have been loaded and the video element is available
		if (!modelsLoaded || !videoRef.current) return;

		const video = videoRef.current;
		const canvas = canvasRef.current;
		// If there's no canvas element, bail
		if (!canvas) return;

		// This is the function that detects expressions in the video stream
		// const detectExpressions = async () => {
		// 	// Only do this if the video is ready
		// 	if (video.readyState === 4) {
		// 		// Try to detect all faces in the video stream with the face-api
		// 		try {
		// 			const detections = await faceapi
		// 				.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
		// 				.withFaceExpressions();

		// 			if (detections.length > 0) {
		// 				// Get the expressions from the first detection
		// 				const expressions = detections[0].expressions;
		// 				// Get the dominant expression by finding the one with the highest confidence
		// 				const dominantExpression = Object.keys(expressions).reduce(
		// 					(a, b) =>
		// 						expressions[a as keyof typeof expressions] >
		// 						expressions[b as keyof typeof expressions]
		// 							? a
		// 							: b,
		// 				) as keyof typeof EXPRESSION_EMOJIS;

		// 				// Only show emoji if confidence is high enough
		// 				if (expressions[dominantExpression] > 0.7) {
		// 					// Get the emoji associated with the dominant expression
		// 					const emoji = EXPRESSION_EMOJIS[dominantExpression];
		// 					// Create an object with a random position and the emoji
		// 					const newEmoji = {
		// 						id: Date.now().toString(),
		// 						emoji,
		// 						x: Math.random() * 80 + 10, // Random position
		// 						y: Math.random() * 80 + 10,
		// 					};

		// 					// Add the new emoji to the state variable
		// 					setFloatingEmojis((prev) => [...prev, newEmoji]);

		// 					// Remove emoji after 2 seconds
		// 					setTimeout(() => {
		// 						// Remove the emoji from the state variable
		// 						setFloatingEmojis((prev) =>
		// 							prev.filter((e) => e.id !== newEmoji.id),
		// 						);
		// 					}, 2000);
		// 				}
		// 			}
		// 		} catch (error) {
		// 			// If there's an error, log it to the console
		// 			console.error("Expression detection error:", error);
		// 		}
		// 	}
		// };
		const detectExpressions = async () => {
			if (video.readyState === 4 && canvas) {
				const displaySize = {
					width: video.videoWidth,
					height: video.videoHeight,
				};

				// Sesuaikan ukuran canvas
				faceapi.matchDimensions(canvas, displaySize);

				const detections = await faceapi
					.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
					.withFaceExpressions();

				const resizedDetections = faceapi.resizeResults(
					detections,
					displaySize,
				);

				// Clear canvas
				const ctx = canvas.getContext("2d");
				if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

				// draw face detections
				faceapi.draw.drawDetections(canvas, resizedDetections);

				// (Optional) gambar label ekspresi:
				// faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

				// Emoji seperti sebelumnya
				if (detections.length > 0) {
					const expressions = detections[0].expressions;
					const dominantExpression = Object.keys(expressions).reduce((a, b) =>
						expressions[a as keyof typeof expressions] >
						expressions[b as keyof typeof expressions]
							? a
							: b,
					) as keyof typeof EXPRESSION_EMOJIS;

					if (expressions[dominantExpression] > 0.7) {
						const emoji = EXPRESSION_EMOJIS[dominantExpression];
						const newEmoji = {
							id: Date.now().toString(),
							emoji,
							x: Math.random() * 80 + 10,
							y: Math.random() * 80 + 10,
						};

						setFloatingEmojis((prev) => [...prev, newEmoji]);
						setTimeout(() => {
							setFloatingEmojis((prev) =>
								prev.filter((e) => e.id !== newEmoji.id),
							);
						}, 2000);
					}
				}
			}
		};

		// Call the function every second to check for new expressions
		const interval = setInterval(detectExpressions, 1000);
		// Return a function that clears the interval when the component unmounts
		return () => clearInterval(interval);
	}, [modelsLoaded]);

	return (
		<div className="relative w-full h-full">
			<video
				ref={videoRef}
				autoPlay
				playsInline
				className="w-full h-full object-cover"
			>
				<track kind="captions" src="" label="No captions" default />
			</video>
			<canvas
				ref={canvasRef}
				width={videoWidth}
				height={videoHeight}
				className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
			/>
			{/* Show all the floating emojis */}
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
				{/* Show the name of the remote user */}
				{participant.user?.name || "Remote User"}
			</div>
		</div>
	);
}

// VideoRoom component: Main logic for the video call interface
export function LiveVideo({
	roomCode,
	onLeave,
}: {
	roomCode: string;
	onLeave: () => void;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [peer, setPeer] = useState<Peer | null>(null);
	const [remotePeers, setRemotePeers] = useState<
		Record<string, { stream: MediaStream }>
	>({});
	const setPeerId = useMutation(api.multiplayer.setPeerId);
	const user = useQuery(api.app.getCurrentUser);
	const [floatingEmojis, setFloatingEmojis] = useState<
		Array<{
			id: string;
			emoji: string;
			x: number;
			y: number;
		}>
	>([]);
	const [modelsLoaded, setModelsLoaded] = useState(false);

	const participants = useQuery(api.multiplayer.getRoomParticipants, {
		roomCode,
	});
	const leaveRoomMutation = useMutation(api.multiplayer.leaveMultiplayerRoom);

	const [videoWidth, setVideoWidth] = useState(640);
	const [videoHeight, setVideoHeight] = useState(480);

	// Load face-api models
	useEffect(() => {
		const loadModels = async () => {
			try {
				const MODEL_URL = "/models";
				await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
				await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

				setModelsLoaded(true);
			} catch (error) {
				console.error("Failed to load face-api models:", error);
				toast.error("Failed to load expression detection models");
			}
		};
		loadModels();
	}, []);

	// Effect 1: Acquire and set local media stream (camera and microphone)
	useEffect(() => {
		let isActive = true;
		let currentLocalStream: MediaStream | null = null;

		const setupLocalMedia = async () => {
			try {
				const mediaStream = await navigator.mediaDevices.getUserMedia({
					video: true,
					audio: true,
				});
				if (isActive) {
					currentLocalStream = mediaStream;
					setLocalStream(mediaStream);
				}
			} catch (err) {
				console.error("Local media (camera/mic) setup error:", err);
				if (isActive) {
					toast.error(
						"Failed to access camera/microphone. Please check permissions.",
					);
				}
			}
		};

		setupLocalMedia();

		return () => {
			isActive = false;
			if (currentLocalStream) {
				// biome-ignore lint/complexity/noForEach: <explanation>
				currentLocalStream.getTracks().forEach((track) => {
					track.stop();
				});
			}
		};
	}, []);

	// Effect 2: Attach local stream to the video element when available
	useEffect(() => {
		if (localStream && videoRef.current) {
			videoRef.current.srcObject = localStream;
			videoRef.current.muted = true;
			videoRef.current.play().catch((err) => {
				console.error("Local video play() failed:", err);
				toast.error("Could not play local video.");
			});

			// Update video dimensions when metadata is loaded
			const handleLoadedMetadata = () => {
				if (videoRef.current) {
					setVideoWidth(videoRef.current.videoWidth || 640);
					setVideoHeight(videoRef.current.videoHeight || 480);
				}
			};
			videoRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);

			return () => {
				videoRef.current?.removeEventListener(
					"loadedmetadata",
					handleLoadedMetadata,
				);
			};
		}
	}, [localStream]);

	// Expression detection for local video
	useEffect(() => {
		if (!modelsLoaded || !localStream || !videoRef.current) return;

		const video = videoRef.current;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const detectExpressions = async () => {
			if (video.readyState === 4 && canvas) {
				const displaySize = {
					width: video.videoWidth,
					height: video.videoHeight,
				};

				// Sesuaikan ukuran canvas
				faceapi.matchDimensions(canvas, displaySize);

				const detections = await faceapi
					.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
					.withFaceExpressions();

				const resizedDetections = faceapi.resizeResults(
					detections,
					displaySize,
				);

				// Clear canvas
				const ctx = canvas.getContext("2d");
				if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

				// draw face detections
				faceapi.draw.drawDetections(canvas, resizedDetections);

				// (Optional) gambar label ekspresi:
				// faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

				// Emoji seperti sebelumnya
				if (detections.length > 0) {
					const expressions = detections[0].expressions;
					const dominantExpression = Object.keys(expressions).reduce((a, b) =>
						expressions[a as keyof typeof expressions] >
						expressions[b as keyof typeof expressions]
							? a
							: b,
					) as keyof typeof EXPRESSION_EMOJIS;

					if (expressions[dominantExpression] > 0.7) {
						const emoji = EXPRESSION_EMOJIS[dominantExpression];
						const newEmoji = {
							id: Date.now().toString(),
							emoji,
							x: Math.random() * 80 + 10,
							y: Math.random() * 80 + 10,
						};

						setFloatingEmojis((prev) => [...prev, newEmoji]);
						setTimeout(() => {
							setFloatingEmojis((prev) =>
								prev.filter((e) => e.id !== newEmoji.id),
							);
						}, 2000);
					}
				}
			}
		};

		const interval = setInterval(detectExpressions, 1000); // Check every second
		return () => clearInterval(interval);
	}, [modelsLoaded, localStream]);

	// Effect 3: Initialize PeerJS and handle incoming calls
	useEffect(() => {
		if (!localStream) return;

		const newPeer = new Peer();
		setPeer(newPeer);

		newPeer.on("open", async (peerId) => {
			try {
				console.log({
					multiplayerPlayerId: participants?.find((p) => p.userId === user?._id)
						?._id,
					peerId,
				});

				await setPeerId({
					multiplayerPlayerId: participants?.find((p) => p.userId === user?._id)
						?._id as Id<"multiplayer_players">,
					peerId,
				});
			} catch (err) {
				toast.error("Failed to join room signaling server.");
				console.error("Join room mutation error:", err);
			}
		});

		newPeer.on("call", (call) => {
			call.answer(localStream);
			call.on("stream", (remoteStream) => {
				setRemotePeers((prevPeers) => ({
					...prevPeers,
					[call.peer]: { stream: remoteStream },
				}));
			});
			call.on("close", () => {
				setRemotePeers((prevPeers) => {
					const updatedPeers = { ...prevPeers };
					delete updatedPeers[call.peer];
					return updatedPeers;
				});
			});
			call.on("error", (err) => {
				console.error("Incoming call error:", err);
				toast.error("Error with an incoming call.");
			});
		});

		return () => {
			newPeer.destroy();
		};
	}, [localStream, roomCode]);

	// Effect 4: Call other participants when they join or when local PeerJS is ready
	useEffect(() => {
		if (!participants || !peer || !localStream) return;

		for (const participant of participants) {
			const isSelf = participant.peerId === peer.id;
			const isAlreadyConnected =
				participant.peerId && remotePeers[participant.peerId];

			if (participant.peerId && !isSelf && !isAlreadyConnected) {
				// Check if peer is still valid before calling
				if (!peer.destroyed) {
					const call = peer.call(participant.peerId, localStream);

					call.on("stream", (remoteStream) => {
						setRemotePeers((prevPeers) => ({
							...prevPeers,
							[participant.peerId as string]: { stream: remoteStream },
						}));
					});
					call.on("close", () => {
						setRemotePeers((prevPeers) => {
							const updatedPeers = { ...prevPeers };
							delete updatedPeers[participant.peerId as string];
							return updatedPeers;
						});
					});
					call.on("error", (err) => {
						console.error("Outgoing call error to", participant.peerId, err);
					});
				}
			}
		}
	}, [participants, peer, localStream, remotePeers]);

	const handleLeaveRoom = async () => {
		if (localStream) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			localStream.getTracks().forEach((track) => track.stop());
		}
		if (peer) {
			peer.destroy();
		}
		try {
			await leaveRoomMutation({ roomCode });
		} catch (error) {
			console.error("Leave room mutation error:", error);
			toast.error("Error leaving room.");
		}
		onLeave();
	};

	if (!localStream) {
		return (
			<div className="p-4 w-full lg:w-[19rem] text-center text-gray-700">
				Accessing your camera and microphone...
				<br />
				Please ensure permissions are granted in your browser.
				{modelsLoaded && (
					<div className="mt-2 text-green-600">
						✓ Expression detection models loaded
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="flex gap-4w-full  h-full">
			<div className="flex-1 grid grid-cols-1 gap-4 p-4 overflow-auto">
				{/* Local video display */}
				<div className="relative lg:w-[19rem] aspect-video bg-gray-200 rounded-lg overflow-hidden shadow">
					<video
						ref={videoRef}
						autoPlay
						playsInline
						muted
						className="w-full h-full object-cover mirror"
					/>
					<canvas
						ref={canvasRef}
						width={videoWidth}
						height={videoHeight}
						className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
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
					<div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
						You (Local)
					</div>
				</div>

				{/* Remote videos display */}
				{participants?.map((participant) => {
					if (participant.peerId === peer?.id) return null;

					const remotePeerStream = participant.peerId
						? remotePeers[participant.peerId]
						: null;

					return (
						<div
							key={participant._id}
							className="relative aspect-video lg:w-[19rem] bg-gray-700 rounded-lg overflow-hidden shadow"
						>
							{remotePeerStream ? (
								<RemoteVideo
									stream={remotePeerStream.stream}
									participant={participant}
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center text-white">
									<div className="text-center">
										<div className="text-3xl mb-2 animate-pulse">👤</div>
										<p className="text-sm">
											{participant.userId || "Connecting..."}
										</p>
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
