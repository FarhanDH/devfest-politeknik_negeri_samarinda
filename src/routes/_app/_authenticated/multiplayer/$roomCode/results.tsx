import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@cvx/_generated/api';
import { Avatar } from '@/components/retroui/Avatar';
import { Button } from '@/components/ui/button';
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-purple-600 to-blue-500 text-white">
        <Loader2 className="w-16 h-16 animate-spin mb-4" />
        <Text as="h2">Loading Results...</Text>
      </div>
    );
  }

  if (resultsDataQuery === null || resultsDataQuery.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-500 text-white">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <Text as="h2">Error Loading Results</Text>
        <Text className="mt-2 text-center">
          {resultsDataQuery?.error || 'Could not load quiz results. Please try again.'}
        </Text>
        <Button
          onClick={() => navigate({ to: '/dashboard', replace: true })}
          className="mt-6 bg-white text-red-500 hover:bg-red-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }

  // Check for errors from resultsDataQuery or if currentUser is not available
  if (resultsDataQuery === null || resultsDataQuery.error || currentUserQuery === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-500 text-white">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <Text as="h2">Error Accessing Data</Text>
        <Text className="mt-2 text-center">
          {resultsDataQuery?.error || (currentUserQuery === null ? 'Current user not found or not authenticated.' : 'Could not load necessary data.')}
        </Text>
        <Button
          onClick={() => navigate({ to: '/dashboard', replace: true })}
          className="mt-6 bg-white text-red-500 hover:bg-red-100"
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-yellow-500 text-white">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <Text as="h2">No Player Data</Text>
        <Text className="mt-2 text-center">Player data is currently unavailable for this quiz.</Text>
        <Button
          onClick={() => navigate({ to: '/dashboard', replace: true })}
          className="mt-6 bg-white text-yellow-700 hover:bg-yellow-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }

  const topScore = players.length > 0 ? players[0].score : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 flex flex-col items-center justify-center p-4 selection:bg-orange-300 selection:text-orange-900">
      <Card className="w-full max-w-2xl shadow-2xl bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden my-8">
        <Card.Header className="bg-black/50 text-white p-6 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <Card.Title className="text-3xl md:text-4xl !font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-300 to-red-300">
            Quiz Results
          </Card.Title>
          <Card.Description className="text-yellow-200 mt-2 text-lg">
            {quizTitle}
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-6 md:p-8 space-y-4 max-h-[60vh] overflow-y-auto">
          {players.map((player, idx) => (
            <div
              key={player.userId}
              className={`flex items-center p-4 rounded-lg transition-all duration-300 shadow-md hover:shadow-lg 
                          ${player.userId === currentUserId ? 'bg-purple-200 border-2 border-purple-600 scale-105' : 'bg-white/80'}
                          ${player.score === topScore && topScore > 0 ? 'border-2 border-yellow-500' : ''}`}
            >
              <Text as="p" className={`mr-4 font-bold text-xl w-8 text-center ${player.userId === currentUserId ? 'text-purple-700' : 'text-gray-700'}`}>
                {idx + 1}
                {player.score === topScore && topScore > 0 && idx === 0 && <Trophy className="inline h-5 w-5 ml-1 text-yellow-600" />}
                {player.score === topScore && topScore > 0 && idx > 0 && player.score === players[idx-1].score && <Trophy className="inline h-5 w-5 ml-1 text-yellow-600" />}
              </Text>
              <Avatar className="h-12 w-12 mr-4 border-2 border-purple-400">
                <Avatar.Image src={player.profileImage || undefined} alt={player.username} />
                <Avatar.Fallback className="bg-purple-500 text-white text-md">
                  {getPlayerInitials(player.username)}
                </Avatar.Fallback>
              </Avatar>
              <div className="flex-grow">
                <Text as="p" className={`font-semibold text-lg truncate ${player.userId === currentUserId ? 'text-purple-900' : 'text-gray-800'}`}>
                  {player.username}
                  {player.userId === hostId && <Crown className="inline h-4 w-4 ml-1.5 text-orange-500" />}
                </Text>
                <Text as="p" className={`text-md ${player.userId === currentUserId ? 'text-purple-700' : 'text-gray-600'}`}>
                  Score: {player.score}
                </Text>
              </div>
            </div>
          ))}
          {players.length === 0 && (
            <Text className="text-center text-gray-600 py-4">No players participated or results are not available.</Text>
          )}
        </Card.Content>
        <div className="p-6 bg-black/10 flex flex-col sm:flex-row justify-center items-center gap-4">
          {roomStatus === 'finished' && quizId && (
            <Button 
              onClick={() => navigate({ to: '/quizzes/$quizId', params: { quizId } })}
              className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105"
            >
              <RotateCcw className="mr-2 h-5 w-5" /> Play This Quiz Again (Solo)
            </Button>
          )}
          <Button 
            onClick={() => navigate({ to: '/dashboard', replace: true })}
            variant="outline"
            className="w-full sm:w-auto bg-white/80 hover:bg-purple-100 border-purple-300 text-purple-800 font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105"
          >
            <ArrowLeft className="mr-2 h-5 w-5" /> Back to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
