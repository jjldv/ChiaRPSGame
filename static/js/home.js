let UserSession = new Session();
IS_MAINNET = null;
document.addEventListener("DOMContentLoaded", async function () {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    updateDashboard();
});
async function updateDashboard(showLoading = false) {
    try {
        const Rstats = await Utils.getGlobalStats(showLoading);
        
        const stats = Rstats.data.globalStats;
        const data = Rstats.data;
        document.getElementById('totalClosedGames').textContent = stats.totalClosedGames.toLocaleString();
        document.getElementById('totalOpenGames').textContent = stats.totalOpenGames.toLocaleString();
        document.getElementById('totalPlayers').textContent = stats.totalPlayers.toLocaleString();
        document.getElementById('totalVolume').textContent = Utils.formatMojosPrefix(stats.totalVolume,IS_MAINNET);
        document.getElementById('biggestGame').textContent = Utils.formatMojosPrefix(stats.biggestGame,IS_MAINNET);
        document.getElementById('biggestGameLink').href = `/gameDetails/${stats.biggestGameCoinId}`;

    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}