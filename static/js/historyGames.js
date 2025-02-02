let UserSession = new Session();
const PUBKEY = Utils.getPublicKeyFromUrl();
if (!PUBKEY) {
    window.location.replace("/");
}
IS_MAINNET = null;
document.addEventListener("DOMContentLoaded", async function () {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    getHistoryGames();
});
async function getHistoryGames() {
    const RGames = await Utils.getHistoryGames(true);
    if (RGames.success) {
        const gamesBody = document.getElementById('Games');
        gamesBody.innerHTML = '';
        
        RGames.historyGames.forEach(game => {
            const row = document.createElement('tr');
            
          
 
            const resultClass = {
                'REVEALED': 'bg-success', 
                'CLAIMED': 'bg-danger',
                'UNSPENT': 'bg-info'
            }[game.status] || 'bg-info';
 
            // Determinar nombres para mostrar
            const player1Display = game.namePlayer1 === game.publicKeyPlayer1 ? "Anonymous" : game.namePlayer1;
            const player2Display = game.namePlayer2 === game.publicKeyPlayer2 ? "Anonymous" : game.namePlayer2;
            const player1Trophy = game.publicKeyWinner === game.publicKeyPlayer1 ? '🏆' : '';
            const player2Trophy = game.publicKeyWinner === game.publicKeyPlayer2 ? '🏆' : '';
            row.innerHTML = `
                <td class="text-center">${game.date}</td>
                <td class="text-center">
                    <div class="d-flex justify-content-center gap-2">
                        <span>${game.player1_emoji || '❓'}</span>
                        <span class="text-muted">vs</span>
                        <span>${game.player2_emoji || '❓'}</span>
                    </div>
                </td>
                <td class="text-center">
                   <a href="/userProfile/${game.publicKeyPlayer1}" class="text-decoration-none">
                       ${player1Display}${player1Trophy}
                   </a>
               </td>
               <td class="text-center">
                   ${game.publicKeyPlayer2 ? 
                       `<a href="/userProfile/${game.publicKeyPlayer2}" class="text-decoration-none">
                           ${player2Display}${player2Trophy}
                       </a>` 
                       : '-'}
               </td>
                <td class="text-center">
                    <span class="badge ${resultClass}">
                        ${game.status}
                    </span>
                </td>
                <td class="text-center">${Utils.formatMojosPrefix(game.amount, IS_MAINNET)}</td>
                <td class="text-center">
                    <a href="/gameDetails/${game.coinId}" class="text-decoration-none">
                        <span class="d-inline-flex align-items-center">
                            ${game.gameStatusDescription}
                        </span>
                    </a>
                </td>
            `;
            gamesBody.appendChild(row);
        });
    }
 }


