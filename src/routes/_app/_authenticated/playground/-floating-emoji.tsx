// Floating emoji component
export default function FloatingEmoji({
	emoji,
	x,
	y,
	id,
}: Readonly<{ emoji: string; x: number; y: number; id: string }>) {
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
