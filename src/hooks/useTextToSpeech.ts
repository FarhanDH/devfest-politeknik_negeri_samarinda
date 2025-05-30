import { useCallback, useEffect, useState } from "react";

interface UseTextToSpeechOptions {
	lang?: string;
}

interface UseTextToSpeechReturn {
	speak: (text: string) => void;
	stop: () => void;
	isSupported: boolean;
}

// Shared global speech synthesis control
const synth: SpeechSynthesis | null =
	typeof window !== "undefined" && "speechSynthesis" in window
		? window.speechSynthesis
		: null;

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function useTextToSpeech(
	options: UseTextToSpeechOptions = {},
): UseTextToSpeechReturn {
	const { lang = "id-ID" } = options;
	const [isSupported, setIsSupported] = useState<boolean>(false);

	useEffect(() => {
		if (synth && typeof SpeechSynthesisUtterance !== "undefined") {
			setIsSupported(true);
		}
	}, []);

	const speak = useCallback(
		(text: string) => {
			if (!synth || !text) return;

			// Stop any currently speaking utterance
			synth.cancel();

			// Create a new utterance
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = lang;
			currentUtterance = utterance;
			synth.speak(utterance);
		},
		[lang],
	);

	const stop = useCallback(() => {
		if (!synth) return;
		synth.cancel();
		currentUtterance = null;
	}, []);

	return { speak, stop, isSupported };
}
