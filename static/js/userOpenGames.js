let UserSession = new Session();
const PUBKEY = Utils.getPublicKeyFromUrl();
if (!PUBKEY) {
    window.location.replace("/");
}
IS_MAINNET = null;
document.addEventListener("DOMContentLoaded", async function () {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    getUserOpenGames();
    let urlPubkey = window.location.pathname.split('/').pop();
    HrefProfile.href = "/userProfile/" + urlPubkey;
    HrefClosedUserGames.href = "/userHistoryGames/" + urlPubkey;
    userPublicKey.innerHTML = urlPubkey;
    let userName = await Utils.getUserName(urlPubkey);
    if (userName.success) {
        UserNameLbl.innerHTML = userName.name;
    }
});
async function getUserOpenGames() {
    const RGames = await Utils.getUserOpenGames(PUBKEY, true);
    if (RGames.success){
        const gamesBody = document.getElementById('Games');
        gamesBody.innerHTML = '';
        RGames.games.forEach(game => {
            const row = document.createElement('tr');
           
            const resultClass = {
                'WIN': 'bg-success',
                'LOSS': 'bg-danger',
                'DRAW': 'bg-warning',
                'OPEN': 'bg-info',
                'CLOSED': 'bg-danger'
            }[game.result];

            row.innerHTML = `
                <td class="text-center">${game.date}</td>
                <td class="text-center">${game.moveEmoji || '❓'}</td>
                <td class="text-center">${game.opponentKey === '----' ? '----' : `<a href="/userProfile/${game.opponentKey}">${game.opponent == game.opponentKey ? "Anonymous" : game.opponent}</a>`}</td>
                <td class="text-center">
                    <span class="badge ${resultClass}">
                        ${game.status === 'OPEN' ? 'OPEN' : game.result}
                    </span>
                </td>
                <td class="text-center">${Utils.formatMojosPrefix(game.amount, IS_MAINNET)}</td>
                <td class="text-center">
                    <a href="/gameDetails/${game.coinId}">
                        ${game.gameStatusDescription}
                    </a>
                </td>
            `;
         gamesBody.appendChild(row);
        });
    }
}




