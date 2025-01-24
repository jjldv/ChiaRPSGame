let UserSession = new Session();
const PUBKEY = Utils.getPublicKeyFromUrl();
if (!PUBKEY) {
    window.location.replace("/");
}
IS_MAINNET = null;
document.addEventListener("DOMContentLoaded", async function () {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    getUserHistoryGames();
});
async function getUserHistoryGames() {
    const RopenGames = await Utils.getUserHistoryGames(PUBKEY, true);
    gameList.innerHTML = "";
    if (RopenGames.success){
        for (let i = 0; i < RopenGames.historyGames.length; i++) {
            const openGame = RopenGames.historyGames[i];
            const date = new Date(openGame.timestamp * 1000);
            const formattedDate = date.toLocaleString();
            const row = `<div class="col-md-4">
            <div class="card mb-4 shadow-sm">
                <img src="/static/images/OpenGameThumbnail.jpg" class="card-img-top" alt="Placeholder Image">
                <div class="card-header bg-primary text-white">
                    <h4 class="my-0 font-weight-normal" title="Coin Id:${openGame.coinId}">${openGame.coinId.substring(0, 15)}...</h4>
                </div>
                <div class="card-body">
                    <h1 class="card-title pricing-card-title" style="color:white;text-align:center;">${Utils.formatMojosPrefix(openGame.gameAmount,IS_MAINNET)}</h1>
                    <div class="mb-2">
                        <p style="color:white;text-align:center;margin:0px;">Status</p>
                        <p style="color:white;text-align:center;margin:0px;">${openGame.gameStatusDescription}</p>
                        <p style="color:white;text-align:center;margin:0px;">${formattedDate}</p>
                    </div>
                    <a href="/gameDetails/${openGame.coinId}">
                        <button type="button" class="btn btn-lg btn-block btn-outline-primary">Details</button>
                    </a>
                </div>
            </div>
        </div>`;
            gameList.innerHTML += row;
        }
    }
}




