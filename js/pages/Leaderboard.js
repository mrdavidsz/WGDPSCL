// Assuming the existing code contains logic for displaying the leaderboard

function displayLeaderboard(leaderboardData) {
    if (!leaderboardData) {
        console.warn('Leaderboard data is null or undefined.');
        return;
    }

    leaderboardData.forEach(player => {
        const totalScore = player.totalScore || 0; // Null-safe check for total score
        const localizedScore = totalScore.toLocaleString('en-US'); // Localizing the score
        console.log(`Player: ${player.name}, Score: ${localizedScore}`);
    });
}

// Example usage
const leaderboard = [{ name: 'Player1', totalScore: 1500 }, { name: 'Player2' }];
displayLeaderboard(leaderboard);