import { api } from "@cvx/_generated/api";
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

// RemoteVideo component to display other participants' streams
export function RemoteVideo({
	stream,
	participant,
}: {
	stream: MediaStream;
	participant: any;
}) {
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

// VideoRoom component: Main logic for the video call interface
export function VideoRoom({
	roomId,
	onLeave,
}: {
	roomId: Id<"rooms">;
	onLeave: () => void;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [peer, setPeer] = useState<Peer | null>(null);
	const [remotePeers, setRemotePeers] = useState<
		Record<string, { stream: MediaStream }>
	>({});
	const [floatingEmojis, setFloatingEmojis] = useState<
		Array<{
			id: string;
			emoji: string;
			x: number;
			y: number;
		}>
	>([]);
	const [modelsLoaded, setModelsLoaded] = useState(false);

	const participants = useQuery(api.rooms.getRoomParticipants, { roomId });
	const leaveRoomMutation = useMutation(api.rooms.leaveRoom);
	const joinRoomMutation = useMutation(api.rooms.joinRoom);

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
		}
	}, [localStream]);

	// Expression detection for local video
	useEffect(() => {
		if (!modelsLoaded || !localStream || !videoRef.current) return;

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
	}, [modelsLoaded, localStream]);

	// Effect 3: Initialize PeerJS and handle incoming calls
	useEffect(() => {
		if (!localStream) return;

		const newPeer = new Peer();
		setPeer(newPeer);

		newPeer.on("open", async (peerId) => {
			try {
				await joinRoomMutation({ roomId, peerId });
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
	}, [localStream, roomId, joinRoomMutation]);

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
							[participant.peerId]: { stream: remoteStream },
						}));
					});
					call.on("close", () => {
						setRemotePeers((prevPeers) => {
							const updatedPeers = { ...prevPeers };
							delete updatedPeers[participant.peerId];
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
			await leaveRoomMutation({ roomId });
		} catch (error) {
			console.error("Leave room mutation error:", error);
			toast.error("Error leaving room.");
		}
		onLeave();
	};

	if (!localStream) {
		return (
			<div className="p-4 text-center text-gray-700">
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
		<div className="flex flex-col gap-4 h-full">
			<div className="flex justify-between items-center p-4 border-b">
				<div>
					<h2 className="text-2xl font-semibold text-primary">Video Call</h2>
					{modelsLoaded && (
						<p className="text-sm text-green-600">
							😊 Expression detection active
						</p>
					)}
				</div>
				{/* biome-ignore lint/a11y/useButtonType: <explanation> */}
				<button
					onClick={handleLeaveRoom}
					className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
				>
					Leave Room
				</button>
			</div>

			<div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-auto">
				{/* Local video display */}
				<div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden shadow">
					<video
						ref={videoRef}
						autoPlay
						playsInline
						muted
						className="w-full h-full object-cover mirror"
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
							className="relative aspect-video bg-gray-700 rounded-lg overflow-hidden shadow"
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
											{participant.user?.name || "Connecting..."}
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
