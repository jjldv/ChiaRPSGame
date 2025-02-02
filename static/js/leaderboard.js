let UserSession = new Session();
IS_MAINNET = null;
document.addEventListener("DOMContentLoaded", async function () {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    updateDashboard(true);
    setInterval(updateDashboard, 30000);
});
async function updateDashboard(showLoading = false) {
    try {
        const Rstats = await Utils.getGlobalStats(showLoading);
        
        // Update global stats
        const stats = Rstats.data.globalStats;
        const data = Rstats.data;
        document.getElementById('totalClosedGames').textContent = stats.totalClosedGames.toLocaleString();
        document.getElementById('totalOpenGames').textContent = stats.totalOpenGames.toLocaleString();
        document.getElementById('totalPlayers').textContent = stats.totalPlayers.toLocaleString();
        document.getElementById('totalVolume').textContent = Utils.formatMojosPrefix(stats.totalVolume,IS_MAINNET);
        document.getElementById('biggestGame').textContent = Utils.formatMojosPrefix(stats.biggestGame,IS_MAINNET);
        document.getElementById('biggestGameLink').href = `/gameDetails/${stats.biggestGameCoinId}`;

        // Update top winners table
        const winnersTable = document.getElementById('topWinners');
        winnersTable.innerHTML = data.rankings.topWinners.map((winner, index) => `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td><a href="/userProfile/${winner.player}" class="text-success">${winner.playerName}</a></td>
                <td class="text-center">${winner.wins}</td>
            </tr>
        `).join('');

        // Update top earners table
        const earnersTable = document.getElementById('topEarners');
        earnersTable.innerHTML = data.rankings.topEarners
            .filter(earner => earner.netEarnings > 0)
            .map((earner, index) => `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td><a href="/userProfile/${earner.player}" class="text-success">${earner.playerName}</a></td>
                <td class="text-center text-success">
                ${Utils.formatMojosPrefix(earner.netEarnings, IS_MAINNET)}
                </td>
                <td class="text-center">${earner.totalGames}</td>
            </tr>
            `).join('');

        // Update move statistics
        const moveStatsContainer = document.getElementById('moveStats');
        const moveEmojis = {'01': '🪨', '02': '📄', '03': '✂️'};
        moveStatsContainer.innerHTML = data.moveStats.map(move => `
            <div class="col-md-4">
                <div class="text-center mb-3">
                    <h1>${moveEmojis[move.move]}</h1>
                    <h4 class="text-success">${move.winPercentage}%</h4>
                    <p class="text-muted">Won ${move.timesWon} times</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}