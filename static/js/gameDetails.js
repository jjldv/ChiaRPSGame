let UserSession = new Session();
const coinId = window.location.pathname.split("/").pop();
let coinRecord;
let IntervalTx;
let GameAmount = 0;
window.gamedetail = null;
IS_MAINNET = null;
UserSession.on("connected", async () => {
    const feeOptions = [
        { fee: "0", time: -1 },
    ];
    console.log(UserSession.prefix);
    const feeSelector = new FeeSelector(feeOptions, UserSession.prefix);
    feeSelector.on("change", (data) => {
        feeSpendbundle.value = data.value;
    });
    feeSelector.on("timerFinished", () => {
        console.log("Temporizador terminado, actualizando tarifas...");
        //TODO: UPDATE FEE
    });
    
});
document.addEventListener("DOMContentLoaded", async function () {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    coinID.innerHTML = coinId;

    feeSpendbundleClaim.addEventListener("change", async () => {
        await updateReceiveAmountClaim();
        setCmdMessageSignatureClaim();
    });
    await getGameDetails(true);
    getPendingTransactions();
    IntervalTx = setInterval(() => {
        getGameDetails();
        getPendingTransactions();
    }, 30000);

    coinIdSelect.addEventListener("change", async () => {
        if(coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount < GameAmount)
        {
            Utils.displayToast("Insufficient funds");
            coinIdSelect.value = "";
            return;
        }

        await setFeeJoinPlayer2();
        setCmdMessageSignatureJoin();
    });
    
    feeSpendbundleJoin.addEventListener("change", async () => {
        await updateChangeAmount();
        setCmdMessageSignatureJoin();

    });
    cashOutAddress.addEventListener("change", async () => {
        setCmdMessageSignatureJoin();
    });
    RPSSelect.addEventListener("change", async () => {
        setCmdMessageSignatureJoin();
    });
    RPSSelectReveal.addEventListener("change", async () => {
        if(await checkCompromise()){
            getFeeEstimateRevealSelectionPlayer1();
        }
    });
    keyRPSReveal.addEventListener("change", async () => {
        if(await checkCompromise()){
            getFeeEstimateRevealSelectionPlayer1();
        }
    });
    coinIdSelectReveal.addEventListener("change", async () => {
        await getFeeEstimateRevealSelectionPlayer1();
        setCmdMessageSignatureRevealFee();
    });
    feeSpendbundleReveal.addEventListener("change", async () => {
        amountChangeCoinReveal.innerHTML = Utils.formatMojos(coinIdSelectReveal.options[coinIdSelectReveal.selectedIndex].dataset.amount - Utils.XCHToMojos(parseFloat(feeSpendbundleReveal.value)));
        setCmdMessageSignatureRevealFee();
    });
    
});
async function getFeeEstimateRevealSelectionPlayer1(){
    if(coinIdSelectReveal.value == "" || RPSSelectReveal.value == "" || keyRPSReveal.value == "") {
        feeSpendbundleReveal.value = "";
        return;
    }
    const Rfee = await UserSession.getFeeEstimateRevealSelectionPlayer1(coinId,coinIdSelectReveal.value,parseInt(RPSSelectReveal.value),keyRPSReveal.value);
    feeSpendbundleReveal.value = Utils.formatMojos(Rfee);
    setCmdMessageSignatureRevealFee();
    amountChangeCoinReveal.innerHTML = Utils.formatMojos(coinIdSelectReveal.options[coinIdSelectReveal.selectedIndex].dataset.amount - Rfee);
}
async function checkCompromise(){
    selectionRPSHashReveal.innerHTML = "----";
    if(RPSSelectReveal.value == "" || keyRPSReveal.value == ""){
        return false;
    }
    const concatSelectWithKey = await UserSession.concat([parseInt(RPSSelectReveal.value), keyRPSReveal.value]);
    const sha256Message = await UserSession.sha256Hex(concatSelectWithKey);
    if (sha256Message != compromisePlayer1.innerHTML){
        selectionRPSHashReveal.innerHTML = "<span style='color:red;'>INVALID SELECTION</span>";
        return false;
    }
    selectionRPSHashReveal.innerHTML = "<span style='color:green;'>VALID SELECTION</span>";
    setCmdMessageSignatureReveal();
    return true;
}
async function updateReceiveAmount(){
    amountreceiveSpendbundle.innerHTML = Utils.formatMojos(coinRecord.coin.amount - Utils.XCHToMojos(parseFloat(feeSpendbundle.value)));
}
async function updateReceiveAmountClaim(){
    amountreceiveSpendbundleClaim.innerHTML = Utils.formatMojos(coinRecord.coin.amount - Utils.XCHToMojos(parseFloat(feeSpendbundleClaim.value)));
}
async function setFeeJoinPlayer2(){
    if(coinIdSelect.value == ""){
        return;
    }
    const Rfee = await UserSession.getFeeEstimateJoinPlayer2(coinId,coinIdSelect.value);
    feeSpendbundleJoin.value = Utils.formatMojos(Rfee);
    await updateChangeAmount();
}
async function updateChangeAmount(){
    amountChangeCoin.innerHTML = Utils.formatMojos(coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount - (Utils.XCHToMojos(parseFloat(feeSpendbundleJoin.value)) + GameAmount));
}
async function getPendingTransactions() {
    let rows = "";
    pendingTransactions.innerHTML = "";
    const Response = await Utils.getCoinPendingTransaction(coinId);
    
    Response.pendingTransaction.forEach((transaction) => {
        const option = { value: transaction.spend_bundle.coin_spends[0].coin.parent_coin_info }; 
        const card = `
            <div class="card cardWhite">
                <div class="card-title">Pending Transaction</div>
                <div class="card-content">
                    <strong>Coin ID:</strong> ${option.value}<br>
                    <strong>Coin Amount:</strong> ${Utils.formatMojosPrefix(transaction.spend_bundle.coin_spends[0].coin.amount,IS_MAINNET)}<br>
                    <strong>Fee:</strong> ${Utils.formatMojos(transaction.fee)}<br>
                    <strong>Action:</strong> ${Response.action}
                </div>
                <button class="card-button" id="${option.value}">💾</button>
            </div>
        `;
        pendingTransactions.innerHTML += card;
        document.getElementById(option.value).addEventListener("click", async () => {
            Utils.downloadJson(option.value, transaction.spend_bundle);
        });
    });

}
async function getGameDetails(showSpinner = false){
    const RgameInfo = await Utils.getGameDetails(coinId,showSpinner);
    if (!RgameInfo.success){
        return;
    }
    window.gamedetail = RgameInfo.game;
    GameAmount = RgameInfo.game.gameAmount;
    const date = new Date(gamedetail.timestamp * 1000);
    const formattedDate = date.toLocaleString();
    coinDate.innerHTML = formattedDate;
    coinAmount.innerHTML = Utils.formatMojosPrefix(GameAmount,IS_MAINNET);
    publicKeyPlayer1.innerHTML = `<a href="/userHistoryGames/${gamedetail.publicKeyPlayer1}">${gamedetail.publicKeyPlayer1}</a>`;
    compromisePlayer1.innerHTML = gamedetail.compromisePlayer1;
    publicKeyPlayer2.innerHTML = gamedetail.publicKeyPlayer2 !="----" ? `<a href="/userHistoryGames/${gamedetail.publicKeyPlayer2}">${gamedetail.publicKeyPlayer2}</a>` : gamedetail.publicKeyPlayer2;
    selectionPlayer2.innerHTML = gamedetail.emojiSelectionPlayer2;
    gamePuzzleReveal.innerHTML = gamedetail.puzzleReveal;
    gamePuzzleRevealDisassembled.innerHTML = gamedetail.puzzleRevealDisassembled;
    gamePuzzleHash.innerHTML = gamedetail.puzzleHash;
    coinStatus.innerHTML = gamedetail.coinStatus;
    coinStage.innerHTML = gamedetail.gameStatusDescription;
    gameStatus.innerHTML = RgameInfo.gameCoins[RgameInfo.gameCoins.length - 1].gameStatusDescription;
    let htmlContent = '';
    RgameInfo.gameCoins.forEach((coin, index) => {
        htmlContent += `<a href="/gameDetails/${coin.coinId}">${coin.gameStatusDescription}</a><br>`;
    });
    gameCoins.innerHTML = htmlContent
    if(gamedetail.spentBlockIndex != 0){
        CloseGameContainer.style.display = "none";
        JoinGameContainer.style.display = "none";
        RevealGameContainer.style.display = "none";
        ClaimGameContainer.style.display = "none";
    }
    if(gamedetail.spentBlockIndex != 0){
        clearInterval(IntervalTx);
    }
    //Claim Player 2
    if (gamedetail.spentBlockIndex == 0 && gamedetail.stage == 3 && gamedetail.publicKeyPlayer2 == UserSession.pubkey){
        ClaimGameContainer.style.display = "block";
        if(feeSpendbundleClaim.value == "0" || feeSpendbundleClaim.value == ""){
            setFeeClaimGame();
        }
        return;
    }
    if (gamedetail.spentBlockIndex == 0 && gamedetail.stage == 2  && gamedetail.publicKeyPlayer1 == UserSession.pubkey.replace("0x","") ){
        CloseGameContainer.style.display = "block";
        setBalance();
        setInterval(() => {
            setBalance();
        }, 30000);
        return;
    }
    //Reveal Player 1
    if (gamedetail.spent_block_index == 0 && gamedetail.stage == 3 && UserSession.pubkey && UserSession.pubkey == gamedetail.publicKeyPlayer1){
        getBalance();
        RevealGameContainer.style.display = "block";
    }
    //Join Player 2
    if (gamedetail.spent_block_index == 0 && gamedetail.stage == 2 && UserSession.pubkey && UserSession.pubkey != gamedetail.publicKeyPlayer1){
        JoinGameContainer.style.display = "block";
        if(feeSpendbundleJoin.value == "0" || feeSpendbundleJoin.value == ""){
            cashOutAddress.value = UserSession.cashOutAddress??"";
            getBalance();
            gameAmount.innerHTML = Utils.formatMojosPrefix(gamedetail.coin.amount,IS_MAINNET);
        }
    }
}
async function setFeeClaimGame(){
    const Rfee = await UserSession.getFeeEstimateClaimGame(coinId);
    feeSpendbundleClaim.value = Utils.formatMojos(Rfee);
    amountreceiveSpendbundleClaim.innerHTML = Utils.formatMojos(coinRecord.coin.amount - Rfee)
    setCmdMessageSignatureClaim();
}
async function setCmdMessageSignatureClaim(){
    didCmdMessageSingatureClaim.innerHTML = "";
    signatureSpendbundleClaim.value = "";
    const walletAddressPuzzleHash = puzzleHashPlayer1.innerHTML;
    const concatMessage2Sign = await UserSession.concat([5,parseInt(Utils.XCHToMojos(parseFloat(feeSpendbundleClaim.value)))]);
    const sha256Message = await UserSession.sha256Hex(concatMessage2Sign);
    if (!sha256Message) {
        Utils.displayToast("Error sha256");
        return;
    }
    let message = `${sha256Message}${coinId}${UserSession.genesisChallenge}`;
    didCmdMessageSingatureClaim.innerHTML = message;
    
}

async function setCmdMessageSignature(){
    didCmdMessageSingature.innerHTML = "";
    signatureSpendbundle.value = "";
    const walletAddressPuzzleHash = puzzleHashPlayer1.innerHTML;
    const concatMessage2Sign = await UserSession.concat([3,parseInt(Utils.XCHToMojos(parseFloat(feeSpendbundle.value))), "0x"+ walletAddressPuzzleHash]);
    const sha256Message = await UserSession.sha256Hex(concatMessage2Sign);
    if (!sha256Message) {
        Utils.displayToast("Error sha256");
        return;
    }
    let message = `${sha256Message}${coinId}${UserSession.genesisChallenge}`;
    didCmdMessageSingature.innerHTML = message;
    
}
async function setCmdMessageSignatureJoin(){
    didCmdMessageSingatureJoin.innerHTML = "";
    signatureSpendbundleJoin.value = "";
    if(coinIdSelect.value == "" || cashOutAddress.value == "" || feeSpendbundleJoin.value == "" || RPSSelect.value == ""){
        return;
    }
    const walletAddress = cashOutAddress.value;
    let walletAddressPuzzleHash = await Utils.convertAddressToPuzzleHash(
        walletAddress
    );
    if(walletAddressPuzzleHash == null){
        Utils.displayToast("Invalid wallet address");
        return;
    }
    UserSession.setCashOutAddress(cashOutAddress.value);
    const betAmount = 0;
    const actionCashOut = 0;
   
    const oraclePuzzleHash = UserSession.oraclePuzzleHash;
    const concatMessage2Sign = await UserSession.concat([2,GameAmount,parseInt(Utils.XCHToMojos(parseFloat(feeSpendbundleJoin.value))), "0x"+ gamePuzzleHash.innerHTML,parseInt(RPSSelect.value), "0x"+ walletAddressPuzzleHash, "0x"+ oraclePuzzleHash]);
    const sha256Message = await UserSession.sha256Hex(concatMessage2Sign);
    if (!sha256Message) {
        Utils.displayToast("Error setting the sha256 to message to sign", "error");
        return;
    }
    let message = `${sha256Message}${coinIdSelect.value}${UserSession.genesisChallenge}`;
    didCmdMessageSingatureJoin.innerHTML = message;
}
async function closeGame(){
    
    try {
        let fee = Utils.XCHToMojos(parseFloat(feeSpendbundle.value));   
        const gobyCoinSpends = [];
        if ( fee > gamedetail.gameAmount){
            Utils.displayToast("Fee can't be higher than the game amount");
            return false;
            
        }
       
        let solution = await UserSession.createSolutionCloseGame(gamedetail.gameAmount, fee);
        const gameCoinSpend = {
            coin: {
                parent_coin_info: "0x" + gamedetail.parentCoinId,
                puzzle_hash: "0x" + gamedetail.puzzleHash,
                amount: gamedetail.gameAmount
            },
            puzzle_reveal: gamedetail.puzzleReveal,
            solution: solution.solution
        };

       
        const allCoinSpends = [
            ...gobyCoinSpends,
            gameCoinSpend
        ];
        let signature = await UserSession.Goby.signCoinSpends(allCoinSpends);

        let spendBundle = {
            coin_spends: allCoinSpends,
            aggregated_signature: [signature]
        };
        let ServerTx = await UserSession.pushTx(spendBundle);
        console.log("ServerTx:", ServerTx);
        if (!ServerTx.success) {
            Utils.displayToast("Error sending transaction");
            return false;
        }
        Utils.displayToast("Transaction sent successfully");
        feeSpendbundle.value = "0";
        const gameSmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: gamedetail.parentCoinId,
            puzzleHash: gamedetail.puzzleHash,
            amount: gamedetail.gameAmount,
        });
        const gameCoinId =  gameSmartCoin.getName();
        setPendingTransaction(gameCoinId);
        return true;
    } catch (error) {
        console.error("Error in close game:", error);
        return false;
    }
}
async function getBalance() {
    let walletBalanceInfo = await UserSession.getWalletBalance();
    if (walletBalanceInfo.success) {
        let coinSelectElements = document.querySelectorAll('.coinIdSelect');
        let firstCoinSelect = coinSelectElements[0];
        
        let existingCoins = Array.from(firstCoinSelect.options).map((option) => option.value);
        
        walletBalanceInfo.coins.forEach((coin) => {
            if (!existingCoins.includes(coin.coin_id) && coin.amount > 0) {
                let option = document.createElement("option");
                option.value = coin.coin_id;
                option.dataset.amount = coin.amount;
                option.text = Utils.formatMojosPrefix(coin.amount, IS_MAINNET) + " - Coin ID: " + coin.coin_id;

                coinSelectElements.forEach((select) => {
                    select.appendChild(option.cloneNode(true));
                });
            }
        });

        coinSelectElements.forEach((select) => {
            Array.from(select.options).forEach((option) => {
                if (!walletBalanceInfo.coins.some((coin) => coin.coin_id === option.value) && option.value !== "") {
                    console.log("Removing coin from select: ", option.value);
                    select.removeChild(option);
                }
            });

            let selectedCoinId = select.value;
            if (!walletBalanceInfo.coins.some((coin) => coin.coin_id === selectedCoinId)) {
                select.value = "";
            } else {
                select.value = selectedCoinId;
            }
        });
    }
}

async function joinPlayer2(){
    if(coinIdSelect.value == ""){
        Utils.displayToast("Select a coin to join the game");
        return;
    }
    if(RPSSelect.value == ""){
        Utils.displayToast("Select  Rock,Paper or Scissors");
        return;
    }
    if(feeSpendbundleJoin.value == ""){
        Utils.displayToast("Enter a fee to join the game");
        return;
    }
    if(cashOutAddress.value == ""){
        Utils.displayToast("Enter a wallet address to cash out if you win");
        return;
    }
    if(signatureSpendbundleJoin.value == ""){
        Utils.displayToast("Enter the signature to join the game");
        return;
    }
    let walletAddressPuzzleHash = await Utils.convertAddressToPuzzleHash(cashOutAddress.value);
    const RjoinPlayer2 = await UserSession.joinPlayer2(coinId,coinIdSelect.value, Utils.XCHToMojos(parseFloat(feeSpendbundleJoin.value)),RPSSelect.value,walletAddressPuzzleHash, signatureSpendbundleJoin.value);
    if (RjoinPlayer2.message){
        Utils.displayToast(RjoinPlayer2.message);
    }
    signatureSpendbundleJoin.value = "";   
    feeSpendbundleJoin.value = "";
    if(RjoinPlayer2.success){
        getPendingTransactions();
    }
}
async function setCmdMessageSignatureReveal(){
    if(RPSSelectReveal.value == "" || keyRPSReveal.value == ""){
        return;
    }
    const concatMessage2Sign = await UserSession.concat([4,parseInt(RPSSelectReveal.value), keyRPSReveal.value]);
    const sha256Message = await UserSession.sha256Hex(concatMessage2Sign);
    if (!sha256Message) {
        Utils.displayToast("Error setting the sha256 to message to sign", "error");
        return;
    }
    let message = `${sha256Message}${coinId}${UserSession.genesisChallenge}`;
    didCmdMessageSingatureReveal.innerHTML = message;
}


async function revealSelectionPlayer1(){
    if(RPSSelectReveal.value == "" || keyRPSReveal.value == "" || signatureSpendbundleReveal.value == ""){
        Utils.displayToast("Select a Rock,Paper or Scissors and enter the key and signature");
        return;
    }
    if(coinIdSelectReveal.value != "" && (feeSpendbundleReveal.value == "" || signatureSpendbundleFeeReveal.value == ""   )){
        Utils.displayToast("Enter a fee and signature to reveal the selection or unset the coin id to reveal the selection without a fee");
        return;
    }
    if(coinIdSelectReveal.value != "" && amountChangeCoinReveal.innerHTML < 0){
        Utils.displayToast("Insufficient funds to pay the fee");
        return;
    }
    let RrevealSelectionPlayer1
    if(coinIdSelectReveal.value != "" &&  feeSpendbundleReveal.value != ""){
        RrevealSelectionPlayer1 = await UserSession.revealSelectionPlayer1WithFee(coinId,parseInt(RPSSelectReveal.value),keyRPSReveal.value,signatureSpendbundleReveal.value,coinIdSelectReveal.value,Utils.XCHToMojos(parseFloat(feeSpendbundleReveal.value)),signatureSpendbundleFeeReveal.value);
    }
    else{
        RrevealSelectionPlayer1 = await UserSession.revealSelectionPlayer1(coinId,parseInt(RPSSelectReveal.value),keyRPSReveal.value,signatureSpendbundleReveal.value);

    }
    if (RrevealSelectionPlayer1.message){
        Utils.displayToast(RrevealSelectionPlayer1.message);
    }
    if(RrevealSelectionPlayer1.success){
        getPendingTransactions();
    }
    if(RrevealSelectionPlayer1.success){
        RPSSelectReveal.value = "";
        keyRPSReveal.value = "";
        signatureSpendbundleReveal.value = "";
        signatureSpendbundleFeeReveal.value = "";
    }
    
}
async function claimGame(){
    if(feeSpendbundleClaim.value == "" || signatureSpendbundleClaim.value == ""){
        Utils.displayToast("Enter a fee and signature to claim the game");
        return;
    }
    const RclaimGame = await UserSession.claimGame(coinId,Utils.XCHToMojos(parseFloat(feeSpendbundleClaim.value)),signatureSpendbundleClaim.value);
    if (RclaimGame.message){
        Utils.displayToast(RclaimGame.message);
    }
    if(RclaimGame.success){
        getPendingTransactions();
    }
    signatureSpendbundleClaim.value = "";
    feeSpendbundleClaim.value = "";
}
async function setBalance() {
    const balance = await UserSession.getWalletBalance();
    document.querySelectorAll('.walletBalance').forEach(element => {
        element.innerHTML = Utils.formatMojosPrefix(
            balance.spendable,
            UserSession.network == "mainnet"
        );
    });
}
async function setPendingTransaction(coinId) {
    const pendingTransactionsContainer = document.getElementById('pendingTransactions');
    const existingCard = document.getElementById(`card-${coinId}`);
    const Response = await Utils.getCoinPendingTransaction(coinId);

    // Si no existe el card y hay transacción pendiente, crear nuevo card
    if (!existingCard && Response.pendingTransaction && Response.pendingTransaction.length > 0) {
        const transaction = Response.pendingTransaction[0];
        const coinAmount = Response.coin.amount;
        
        const newCard = document.createElement('div');
        newCard.id = `card-${coinId}`;
        newCard.className = 'col-md-12 mb-3';
        newCard.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <button type="button" class="btn-close float-end" aria-label="Close"></button>
                    <div class="d-flex align-items-center gap-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="card-title mb-2 text-white">Pending Transaction</h6>
                        <div class="transaction-details text-white">
                        <p class="mb-1"><strong>Amount:</strong> ${Utils.formatMojosPrefix(coinAmount, IS_MAINNET)}</p>
                        <p class="mb-1"><strong>Fee:</strong> ${Utils.formatMojos(transaction.fee)}</p>
                        <p class="mb-1"><strong>Action:</strong> ${Response.action}</p>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        `;

        // Agregar manejador para el botón de cerrar
        newCard.querySelector('.btn-close').addEventListener('click', () => newCard.remove());
        pendingTransactionsContainer.appendChild(newCard);
    }
    
    // Si existe el card y no hay transacciones pendientes, actualizar a completado
    if (existingCard && (!Response.pendingTransaction || Response.pendingTransaction.length === 0)) {
        existingCard.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <button type="button" class="btn-close float-end" aria-label="Close"></button>
                    <div class="d-flex align-items-center gap-3">
                    <i class="fas fa-check-circle text-success fa-2x"></i>
                    <div class="flex-grow-1">
                        <h6 class="card-title mb-2 text-white">Game Created Successfully!</h6>
                        <a href="/gameDetails/${coinId}" target="_blank" class="btn btn-primary btn-sm">
                        <i class="fas fa-gamepad me-2"></i>View Game
                        </a>
                    </div>
                    </div>
                </div>
            </div>
        `;
        
        // Actualizar manejador del botón de cerrar
        existingCard.querySelector('.btn-close').addEventListener('click', () => existingCard.remove());
        return; // No necesitamos seguir monitoreando
    }

    // Si todavía hay transacción pendiente, continuar monitoreando
    if (Response.pendingTransaction && Response.pendingTransaction.length > 0) {
        setTimeout(() => {
            setPendingTransaction(coinId);
        }, 5000);
    }
}