let UserSession = new Session();
IS_MAINNET = null;
document.addEventListener("DOMContentLoaded", async function () {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    getLeaderboard();
});
async function getLeaderboard() {
    try {
        const RopenGames = await Utils.fetch("/getLeaderboard", {}, true);

        if (RopenGames.success) {

            populateTable('topWinnersTable', RopenGames.topWinners, ['player', 'wins']);
            populateTable('topEarnersTable', RopenGames.topEarners, ['player', 'total_earned']);
        }
    } catch (error) {
        console.error(error);
    }
}

function populateTable(tableId, data, columns) {
    const tableBody = document.getElementById(tableId).querySelector("tbody");
    data.forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((col) => {
            const td = document.createElement("td");
            if (col === "player") {
                const a = document.createElement("a");
                a.href = `/userHistoryGames/${row["publicKeyWinner"]}`;
                a.textContent = row[col].substring(0, 50) + "...";
                td.appendChild(a);
            } 
            else if (col === "total_earned") {
                td.textContent = Utils.formatMojosPrefix(row[col], IS_MAINNET);
            }
            else {
                td.textContent = row[col];
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}
