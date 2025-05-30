import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_app/_authenticated/dashboard/_layout/leaderboard",
)({
	component: RouteComponent,
});

import { HeaderConfiguration } from "@/components/header-provider";
import { Card } from "@/components/retroui/Card";
import { Text } from "@/components/retroui/Text";

function RouteComponent() {
	const {
		data: leaderboard,
		isLoading: isLoadingLeaderboard,
		error: errorLeaderboard,
	} = useQuery(convexQuery(api.app.getLeaderboard, {}));

	const {
		data: currentUser,
		isLoading: isLoadingUser,
		error: errorUser,
	} = useQuery(convexQuery(api.app.getCurrentUser, {}));

	if (isLoadingLeaderboard || isLoadingUser) {
		return (
			<div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)] p-8 flex justify-center items-center">
				<Text as="h2" className="text-2xl">
					LOADING LEADERBOARD...
				</Text>
			</div>
		);
	}

	if (errorLeaderboard || errorUser) {
		return (
			<div className="min-h-screen bg-[var(--background)] text-[var(--destructive)] font-[var(--font-sans)] p-8 flex justify-center items-center text-center">
				<Text as="h2" className="text-2xl">
					ERROR LOADING DATA. PLEASE TRY AGAIN.
				</Text>
				{/* {errorLeaderboard && <Text as="p" className="text-sm">{errorLeaderboard.message}</Text>} */}
				{/* {errorUser && <Text as="p" className="text-sm">{errorUser.message}</Text>} */}
			</div>
		);
	}

	if (!leaderboard || !currentUser) {
		return (
			<div className="min-h-screen bg-[var(--background)] text-[var(--accent)] font-[var(--font-sans)] p-8 flex justify-center items-center">
				<Text as="h2" className="text-2xl">
					NO DATA AVAILABLE.
				</Text>
			</div>
		);
	}

	return (
		<>
			<HeaderConfiguration
				headerTitle="Leaderboard"
				headerDescription="Lihat peringkat teratas pengguna berdasarkan skor quiz mereka dan raih posisi terbaik di leaderboard!"
			/>
			<div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)] p-4 md:p-8 flex flex-col items-center">
				<Card className="w-full max-w-2xl block border-[var(--border)] shadow-[var(--shadow-xl)]">
					<Card.Header className="pb-4 md:pb-6">
						<Text
							as="h1"
							className="text-center font-[var(--font-head)] text-4xl md:text-5xl"
							style={{
								textShadow:
									"0 0 5px var(--primary), 0 0 10px var(--primary), 0 0 15px var(--primary)",
							}}
						>
							LEADERBOARD
						</Text>
					</Card.Header>
					<Card.Content className="space-y-3">
						{leaderboard.length === 0 && (
							<Text
								as="p"
								className="text-center text-xl text-[var(--muted-foreground)] py-4"
							>
								The leaderboard is currently empty. Be the first!
							</Text>
						)}
						{leaderboard.map((player, index) => {
							const isCurrentUser = player._id === currentUser._id;
							const rankColor = isCurrentUser
								? "text-[var(--primary-foreground)]"
								: index === 0
									? "text-[var(--primary)]"
									: index === 1
										? "text-[var(--foreground)]"
										: index === 2
											? "text-[var(--accent)]"
											: "text-[var(--muted-foreground)]";

							return (
								<Card
									key={player._id}
									className={`w-full flex items-center justify-between p-3 md:p-4 transition-all duration-300 ease-in-out transform hover:border-[var(--primary)] hover:shadow-[var(--shadow-lg)]
								${
									isCurrentUser
										? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary-foreground)] scale-105 shadow-[var(--shadow-lg)]"
										: "bg-[var(--card)] text-[var(--card-foreground)] border-[var(--border)] hover:scale-[1.02]"
								}`}
								>
									<div className="flex items-center min-w-0">
										<Text
											as="span"
											className={`text-xl md:text-2xl font-bold w-10 text-center mr-3 md:mr-4 ${rankColor}`}
										>
											{index + 1}
										</Text>
										<Text
											as="span"
											className={`text-lg md:text-xl truncate ${isCurrentUser ? "font-semibold" : ""}`}
										>
											{player.username || "Anonymous Player"}
										</Text>
									</div>
									<Text
										as="span"
										className={`text-lg md:text-xl font-semibold whitespace-nowrap ${isCurrentUser ? "text-[var(--primary-foreground)]" : "text-[var(--accent)]"}`}
									>
										{player.exp} EXP
									</Text>
								</Card>
							);
						})}
					</Card.Content>

					<Card.Content className="mt-6 pt-6 border-t-2 border-dashed border-[var(--muted)]">
						<Text
							as="h2"
							className="text-center font-[var(--font-head)] text-2xl md:text-3xl mb-6"
							style={{
								textShadow: "0 0 5px var(--primary), 0 0 10px var(--primary)",
							}}
						>
							YOUR STATS
						</Text>
						<Card className="p-4 md:p-6 block border-[var(--border)]">
							<div className="flex justify-between items-center mb-3">
								<Text
									as="p"
									className="text-lg md:text-xl text-[var(--muted-foreground)]"
								>
									Player:
								</Text>
								<Text
									as="p"
									className="text-lg md:text-xl text-right truncate font-[var(--font-head)]"
								>
									{currentUser.username || "Your Username"}
								</Text>
							</div>
							<div className="flex justify-between items-center">
								<Text
									as="p"
									className="text-lg md:text-xl text-[var(--muted-foreground)]"
								>
									Experience:
								</Text>
								<Text
									as="p"
									className="text-lg md:text-xl text-[var(--accent)] font-bold font-[var(--font-head)]"
								>
									{currentUser.exp} EXP
								</Text>
							</div>
						</Card>
					</Card.Content>
				</Card>
			</div>
		</>
	);
}
