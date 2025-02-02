let UserSession = new Session();
IS_MAINNET = null;

const PUBKEY = Utils.getPublicKeyFromUrl();
if (!PUBKEY) {
    window.location.replace("/");
}
document.addEventListener("DOMContentLoaded", async function () {
  
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    getUserProfile();
});
async function getUserProfile() {
    try {
        const userProfile = await Utils.getUserProfile(PUBKEY, true);
        if (!userProfile.success) {
            Utils.displayToast("Error loading profile", "error");
            return;
        }
        if (userProfile.rank > 0) {
            document.getElementById('userRank').textContent = `Rank: #${userProfile.rank}`;
        } else {
            document.getElementById('userRank').textContent = 'Unranked';
        }
        document.getElementById('totalGamesHref').href = `/userHistoryGames/${PUBKEY}`;
        document.getElementById('totalOpenGamesHref').href = `/userOpenGames/${PUBKEY}`;
        document.getElementById('playerName').textContent = userProfile.name;
        document.getElementById('playerPublicKey').textContent = userProfile.publicKey;

        document.getElementById('winRate').textContent = `${userProfile.stats.winRate}%`;
        document.getElementById('totalCompletedGames').textContent = userProfile.stats.totalCompletedGames;
        document.getElementById('totalOpenGames').textContent = userProfile.stats.totalOpenGames;
        
       
        const amounts = userProfile.stats.amounts;

        // Total ganado y perdido
        document.getElementById('totalWon').textContent = Utils.formatMojosPrefix(amounts.totalWon,IS_MAINNET);
        document.getElementById('totalLost').textContent = Utils.formatMojosPrefix(amounts.totalLost,IS_MAINNET);

        // Balance total
        const balance = amounts.totalWon - amounts.totalLost;
        const balanceElement = document.getElementById('totalBalance');
        balanceElement.textContent = `Balance: ${Utils.formatMojosPrefix(balance,IS_MAINNET)}`;
        balanceElement.className = balance >= 0 ? 'text-success' : 'text-danger';

        // Promedio y mayor ganancia
        document.getElementById('biggestWin').textContent = Utils.formatMojosPrefix(amounts.biggestWin,IS_MAINNET);
        document.getElementById('bigestWinHref').href = `/gameDetails/${userProfile.stats.amounts.coinIdBiggestWin}`;

        if (userProfile.stats.mostPlayedAgainst) {
            document.getElementById('rivalName').textContent = userProfile.stats.mostPlayedAgainst.name;
            document.getElementById('rivalName').nextElementSibling.textContent = `${userProfile.stats.mostPlayedAgainst.gamesPlayed} games`;
            document.getElementById('mostPlayedAgainst').href = `/userProfile/${userProfile.stats.mostPlayedAgainst.publicKey}`;
        } else {
            document.getElementById('rivalName').textContent = '--';
            document.getElementById('rivalName').nextElementSibling.textContent = '';
        }

        document.getElementById('joinDate').textContent = userProfile.stats.activeSince ? userProfile.stats.activeSince : '--';

        const record = userProfile.stats.record;
        const total = record.wins + record.losses + record.draws;
        
        document.getElementById('totalWins').textContent = record.wins;
        document.getElementById('totalLosses').textContent = record.losses;
        document.getElementById('totalDraws').textContent = record.draws;

        document.querySelector('.progress-bar.bg-success').style.width = 
            `${(record.wins/total * 100).toFixed(1)}%`;
        document.querySelector('.progress-bar.bg-danger').style.width = 
            `${(record.losses/total * 100).toFixed(1)}%`;
        document.querySelector('.progress-bar.bg-warning').style.width = 
            `${(record.draws/total * 100).toFixed(1)}%`;

        const recentGamesBody = document.getElementById('recentGames');
        recentGamesBody.innerHTML = '';

        userProfile.recentGames.forEach(game => {
            const row = document.createElement('tr');
           
            const resultClass = {
                'WIN': 'bg-success',
                'LOSS': 'bg-danger',
                'DRAW': 'bg-warning',
                'OPEN': 'bg-info'
            }[game.result];

            row.innerHTML = `
                <td class="text-center">${game.date}</td>
                <td class="text-center">${game.moveEmoji || '❓'}</td>
                <td class="text-center"><a href="/userProfile/${game.opponentKey}">${game.opponent == game.opponentKey ? "Anonymous":game.opponent}</a></td>
                <td class="text-center">
                    <span class="badge ${resultClass}">
                        ${game.status === 'OPEN' ? 'OPEN' : game.result}
                    </span>
                </td>
                <td class="text-center">${Utils.formatMojosPrefix(game.amount,IS_MAINNET)}</td>
                <td class="text-center">
                    <a href="/gameDetails/${game.coinId}">
                        ${game.gameStatusDescription}
                    </a>
                </td>
            `;
            recentGamesBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error al cargar el perfil:', error);
    }
}
