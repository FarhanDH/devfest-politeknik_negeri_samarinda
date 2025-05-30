import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@cvx/_generated/api';
import { Avatar } from '@/components/retroui/Avatar';
import { Button } from '@/components/retroui/Button';
import { Card } from '@/components/retroui/Card';
import { Text } from '@/components/retroui/Text';
import { Loader2, AlertTriangle, Trophy, ArrowLeft, RotateCcw, Crown } from 'lucide-react';

export const Route = createFileRoute(
  '/_app/_authenticated/multiplayer/$roomCode/results',
)({
  component: MultiplayerQuizResultsPage,
});

function getPlayerInitials(name: string | undefined) {
  if (!name) return "P";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function MultiplayerQuizResultsPage() {
  const { roomCode } = useParams({ from: '/_app/_authenticated/multiplayer/$roomCode/results' });
  const navigate = useNavigate();
  
  const resultsDataQuery = useQuery(api.multiplayer.getMultiplayerQuizResultsData, {
    roomCode,
  });
  const currentUserQuery = useQuery(api.users.getCurrentUser);

  if (resultsDataQuery === undefined || currentUserQuery === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--background)] text-[var(--foreground)]">
        <Loader2 className="w-16 h-16 animate-spin mb-4 text-[var(--primary)]" />
        <Text as="h2" className="text-2xl font-[var(--font-head)]" style={{ textShadow: '0 0 5px var(--primary), 0 0 10px var(--primary)' }}>Loading Results...</Text>
      </div>
    );
  }

  if (resultsDataQuery === null || resultsDataQuery.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--background)] text-[var(--destructive)]">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <Text as="h2" className="text-2xl font-[var(--font-head)]" style={{ textShadow: '0 0 5px var(--destructive), 0 0 10px var(--destructive)' }}>Error Loading Results</Text>
        <Text as="p" className="mt-2 text-center text-[var(--foreground)]">
          {resultsDataQuery?.error || 'Could not load quiz results. Please try again.'}
        </Text>
        <Button
          onClick={() => navigate({ to: '/dashboard', replace: true })}
          className="mt-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }

  // Check for errors from resultsDataQuery or if currentUser is not available
  if (resultsDataQuery === null || resultsDataQuery.error || currentUserQuery === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--background)] text-[var(--destructive)]">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <Text as="h2" className="text-2xl font-[var(--font-head)]" style={{ textShadow: '0 0 5px var(--destructive), 0 0 10px var(--destructive)' }}>Error Accessing Data</Text>
        <Text as="p" className="mt-2 text-center text-[var(--foreground)]">
          {resultsDataQuery?.error || (currentUserQuery === null ? 'Current user not found or not authenticated.' : 'Could not load necessary data.')}
        </Text>
        <Button
          onClick={() => navigate({ to: '/dashboard', replace: true })}
          className="mt-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }
  // At this point, resultsDataQuery is the successful data object (not null, no .error property)
  // And currentUserQuery is the successful User object (not null)
  const { quizTitle, players, roomStatus, hostId, quizId } = resultsDataQuery;
  const currentUserId = currentUserQuery._id; // Safe now

  // Safeguard for players array (though resultsDataQuery.players should exist if no error)
  if (!players) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--background)] text-[var(--accent)]">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <Text as="h2" className="text-2xl font-[var(--font-head)]" style={{ textShadow: '0 0 5px var(--accent), 0 0 10px var(--accent)' }}>No Player Data</Text>
        <Text as="p" className="mt-2 text-center text-[var(--foreground)]">Player data is currently unavailable for this quiz.</Text>
        <Button
          onClick={() => navigate({ to: '/dashboard', replace: true })}
          className="mt-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }

  const topScore = players.length > 0 ? Math.max(...players.map(p => p.score)) : 0;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)] flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-[var(--shadow-xl)] border-2 border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] my-8">
        <Card.Header className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-[var(--primary)]" />
          <Text as="h1" className="text-3xl md:text-4xl font-[var(--font-head)]" style={{ textShadow: '0 0 5px var(--primary), 0 0 10px var(--primary)' }}>
            Quiz Results
          </Text>
          <Text as="p" className="text-[var(--foreground)] mt-2 text-lg">
            {quizTitle}
          </Text>
        </Card.Header>
        <Card.Content className="p-6 md:p-8 space-y-4 max-h-[60vh] overflow-y-auto">
          {players.map((player, idx) => (
            <div
              key={player.userId}
              className={`flex items-center p-4 rounded-md transition-all duration-300 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)] border border-[var(--border)]
                          ${player.userId === currentUserId ? 'bg-[var(--primary)]/10 border-2 border-[var(--primary)]' : 'bg-[var(--background)]'}
                          ${player.score === topScore && topScore > 0 ? 'border-2 border-[var(--primary)] bg-[var(--background)]' : ''}`}
            >
              <Text as="p" className={`mr-4 text-xl w-8 text-center ${player.userId === currentUserId ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                {idx + 1}
                {player.score === topScore && topScore > 0 && idx === 0 && <Trophy className="inline h-5 w-5 ml-1 text-[var(--primary)]" />}
                {player.score === topScore && topScore > 0 && idx > 0 && player.score === players[idx-1].score && <Trophy className="inline h-5 w-5 ml-1 text-[var(--primary)]" />}
              </Text>
              <Avatar className="h-12 w-12 mr-4 border border-[var(--border)]">
                <Avatar.Image src={player.profileImage || undefined} alt={player.username} />
                <Avatar.Fallback className="bg-[var(--primary)] text-[var(--primary-foreground)] text-md">
                  {getPlayerInitials(player.username)}
                </Avatar.Fallback>
              </Avatar>
              <div className="flex-grow">
                <Text as="p" className={`text-lg truncate ${player.userId === currentUserId ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                  {player.username}
                  {player.userId === hostId && <Crown className="inline h-4 w-4 ml-1.5 text-[var(--primary)]" />}
                </Text>
                <Text as="p" className={`text-md ${player.userId === currentUserId ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                  Score: {player.score}
                </Text>
              </div>
            </div>
          ))}
          {players.length === 0 && (
            <Text as="p" className="text-center text-[var(--muted-foreground)] py-4">No players participated or results are not available.</Text>
          )}
        </Card.Content>
        <Card.Content className="border-t-2 border-dashed border-[var(--border)] pt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
          {roomStatus === 'finished' && quizId && (
            <Button 
              onClick={() => navigate({ to: '/quizzes/$quizId', params: { quizId } })}
              className="w-full sm:w-auto bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] border-2 border-[var(--border)] shadow-[var(--shadow-sm)]"
            >
              <RotateCcw className="mr-2 h-5 w-5" /> Play This Quiz Again (Solo)
            </Button>
          )}
          <Button 
            onClick={() => navigate({ to: '/dashboard', replace: true })}
            variant="outline"
            className="w-full sm:w-auto bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--background)] border-2 border-[var(--border)] shadow-[var(--shadow-sm)]"
          >
            <ArrowLeft className="mr-2 h-5 w-5" /> Back to Dashboard
          </Button>
        </Card.Content>
      </Card>
    </div>
  );
}
