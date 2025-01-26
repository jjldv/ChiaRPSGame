let UserSession = new Session();
const coinId = window.location.pathname.split("/").pop();
let coinRecord;
let IntervalTx = null;
let GameAmount = 0;
let selectedOption = null;
//TODO: change name for LauncherGame to get the control of the games for the user
let gameWalletInfo;
let IntervalBalance = null;
window.gamedetail = null;
IS_MAINNET = null;
UserSession.on("connected", async () => {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    gameWalletInfo = await UserSession.getWalletInfo();
    const feeOptions = [
        { fee: "0", time: -1 },
    ];
    console.log(UserSession.prefix);
    
    if (gamedetail?.spentBlockIndex == 0 && gamedetail.stage == 3 && gamedetail.publicKeyPlayer2 ==  UserSession.pubkey?.replace("0x","")){
        ClaimGameContainer.style.display = "block";
        setFeeClaimSelector();
        return;
    }

    if (gamedetail?.spentBlockIndex == 0 && gamedetail.stage == 2  && gamedetail.publicKeyPlayer1 == UserSession.pubkey?.replace("0x","") ){
        CloseGameContainer.style.display = "block";
        setFeeCloseSelector();
    }
    if (gamedetail?.spentBlockIndex == 0 && gamedetail.stage == 3 && UserSession.pubkey && UserSession.pubkey?.replace("0x","") == gamedetail.publicKeyPlayer1){
        RevealGameContainer.style.display = "block";
        setConfigReveal();
    }

    if (gamedetail?.spentBlockIndex == 0 && gamedetail.stage == 2 && UserSession.pubkey && UserSession.pubkey?.replace("0x","") != gamedetail.publicKeyPlayer1){
        JoinGameContainer.style.display = "block";
        const feeSelectorJoin = new FeeSelector(feeOptions, UserSession.prefix,"feeSelectorContainerJoin");
        feeSelectorJoin.on("change", (data) => {
            feeSpendbundleJoin.value = data.value;
        });
        feeSelectorJoin.on("timerFinished", () => {
            console.log("Temporizador terminado, actualizando tarifas...");
        });
        if(IntervalBalance == null){
            setBalance();
            IntervalBalance = setInterval(() => {
                setBalance();
            }, 30000);
        }
    }
    
});
document.addEventListener("DOMContentLoaded", async function () {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    coinID.innerHTML = coinId;

    await getGameDetails(true);
    

    
});

async function checkCompromise(){
    selectionRPSHashReveal.innerHTML = "----";
    if(selectedOptionReveal.value == "" || keyRPS.value == ""){
        return false;
    }
    const concatSelectWithKey = await UserSession.concat([parseInt(selectedOptionReveal.value), keyRPS.value]);
    const sha256Message = await UserSession.sha256Hex(concatSelectWithKey);
    if (sha256Message != gamedetail.compromisePlayer1){
        selectionRPSHashReveal.innerHTML = "<span style='color:red;'>INVALID SELECTION /  KEY</span>";
        return false;
    }
    selectionRPSHashReveal.innerHTML = "<span style='color:green;'>VALID SELECTION</span>";
    return true;
}
async function updateReceiveAmount(){
    amountreceiveSpendbundle.innerHTML = Utils.formatMojos(coinRecord.coin.amount - Utils.XCHToMojos(parseFloat(feeSpendbundle.value)));
}
async function updateReceiveAmountClaim(){
    amountreceiveSpendbundleClaim.innerHTML = Utils.formatMojos(coinRecord.coin.amount - Utils.XCHToMojos(parseFloat(feeSpendbundleClaim.value)));
}

async function getGameDetails(showSpinner = false){
    const RgameInfo = await Utils.getGameDetails(coinId,showSpinner);
    if (!RgameInfo.success){
        return;
    }
    checkPendingTransaction();
    if ( RgameInfo.game.spentBlockIndex != 0){
        clearInterval(IntervalTx);
    }
    if (RgameInfo.game.spentBlockIndex == 0 && IntervalTx == null){
        IntervalTx = setInterval(() => {
            getGameDetails();
        }, 30000);
    }
    window.gamedetail = RgameInfo.game;
    GameAmount = RgameInfo.game.gameAmount;
    const date = new Date(gamedetail.timestamp * 1000);
    const formattedDate = date.toLocaleString();
    coinDate.innerHTML = formattedDate;
    coinAmount.innerHTML = Utils.formatMojosPrefix(GameAmount,IS_MAINNET);
    document.querySelectorAll('.coinAmount').forEach(element => {
        element.innerHTML = Utils.formatMojosPrefix(GameAmount, IS_MAINNET);
    });
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
    if (gamedetail.spentBlockIndex == 0 && gamedetail.stage == 3 && gamedetail.publicKeyPlayer2 ==  UserSession.pubkey?.replace("0x","")){
        ClaimGameContainer.style.display = "block";
        setFeeClaimSelector();
        return;
    }
    if (gamedetail.spentBlockIndex == 0 && gamedetail.stage == 2  && gamedetail.publicKeyPlayer1 == UserSession.pubkey?.replace("0x","") ){
        CloseGameContainer.style.display = "block";
        setFeeCloseSelector();

    }
    //Reveal Player 1
    if (gamedetail.spentBlockIndex == 0 && gamedetail.stage == 3 && UserSession.pubkey && UserSession.pubkey?.replace("0x","") == gamedetail.publicKeyPlayer1){
        RevealGameContainer.style.display = "block";
        setConfigReveal();
    }
    //Join Player 2
    if (gamedetail.spentBlockIndex == 0 && gamedetail.stage == 2 && UserSession.pubkey && UserSession.pubkey?.replace("0x","") != gamedetail.publicKeyPlayer1){
        JoinGameContainer.style.display = "block";
        if(IntervalBalance == null){
            setBalance();
            IntervalBalance = setInterval(() => {
                setBalance();
            }, 30000);
        }
    }
}




async function closeGame(){
    
    try {
        let fee = Utils.XCHToMojos(parseFloat(feeSpendbundle.value));   
        if ( fee > gamedetail.gameAmount){
            Utils.displayToast("Fee can't be higher than the game amount");
            return false;
            
        }
        
        const gobyCoinSpends = [];
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
        const gameSmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: gamedetail.parentCoinId,
            puzzleHash: gamedetail.puzzleHash,
            amount: gamedetail.gameAmount,
        });
        const gameCoinId =  gameSmartCoin.getName();
        let ServerTx = await UserSession.closeGame(gameCoinId, fee, signature);
        console.log("ServerTx:", ServerTx);
        if (!ServerTx.success) {
            Utils.displayToast(ServerTx.message);
            return false;
        }
        Utils.displayToast("Transaction sent successfully");
        feeSpendbundle.value = "0";
        return true;
    } catch (error) {
        console.error("Error in close game:", error);
        return false;
    }
}


async function joinPlayer2(){
    if(selectedOption == null){
        Utils.displayToast("Select a Rock,Paper or Scissors");
        return;
    }
    if(feeSpendbundleJoin.value == ""){
        Utils.displayToast("Enter a fee to join the game");
        return;
    }
    
    try {
        let betAmount = GameAmount;
        let fee = Utils.XCHToMojos(parseFloat(feeSpendbundleJoin.value));
        let cashOutAddressHash = UserSession.walletPuzzleHash;
        const totalRequired = BigInt(betAmount) + BigInt(fee);
        console.log("Total required:", totalRequired.toString());
        let gameWalletPuzzleHash = gameWalletInfo.wallet_puzzle_hash;
        let changePuzzleHash = cashOutAddressHash;
        const { selectedCoins, totalSelected, change } = await UserSession.Goby.selectCoins(totalRequired);
        if (selectedCoins.length === 0) {
            Utils.displayToast("No coins selected. Insufficient funds.");
            return;
        }
        const gobyCoinSpends = await UserSession.Goby.createStandarCoinSpends(
            selectedCoins,
            gameWalletPuzzleHash,
            betAmount,
            change,
            fee
        );
        gobyCoinSpends.sort((a, b) => a.coin.amount - b.coin.amount);

        const highestCoinSpend = gobyCoinSpends[gobyCoinSpends.length - 1];

        const gobySmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: highestCoinSpend.coin.parent_coin_info,
            puzzleHash: highestCoinSpend.coin.puzzle_hash,
            amount: highestCoinSpend.coin.amount
        });
        const gameWalletSmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: gobySmartCoin.getName(),
            puzzleHash: gameWalletPuzzleHash,
            amount: betAmount
        });
       
        let solutionJoinPlayer2 = await UserSession.createSolutionJoinPlayer2(selectedOption, cashOutAddressHash, coinId);
        const gameWalletCoinSpend = {
            coin: {
                // Añadir el objeto coin dentro de una propiedad coin
                parent_coin_info: "0x" + gameWalletSmartCoin.parentCoinInfo,
                puzzle_hash: "0x" + gameWalletInfo.wallet_puzzle_hash,
                amount: betAmount
            },
            puzzle_reveal: gameWalletInfo.wallet_puzzle_reveal,
            solution: solutionJoinPlayer2.solutionGameWallet
        };

        const gameWalletCoinId = gameWalletSmartCoin.getName();
        const gameSmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: gameWalletCoinId,
            puzzleHash: gameWalletInfo.game_puzzle_hash,
            amount: betAmount
        });
        const gameCoinId = gameSmartCoin.getName();
        const gameCoinSpend = {
            coin: {
                parent_coin_info: "0x" + gamedetail.parentCoinId,
                puzzle_hash: "0x" + gamedetail.puzzleHash,
                amount: betAmount
            },
            puzzle_reveal: gamedetail.puzzleReveal,
            solution: solutionJoinPlayer2.solutionGame
        };
        const allCoinSpends = [
            ...gobyCoinSpends,
            gameWalletCoinSpend,
            gameCoinSpend
        ];
        let signature = await UserSession.Goby.signCoinSpends(allCoinSpends);

        let spendBundle = {
            coin_spends: allCoinSpends,
            aggregated_signature: [signature]
        };
        // let GobyTx = await UserSession.Goby.sendTransaction(spendBundle);
        // console.log("GobyTx:", GobyTx);
        let ServerTx = await UserSession.joinPlayer2(spendBundle,coinId,gobySmartCoin.getName(),0,selectedOption,cashOutAddressHash,signature);
        console.log("ServerTx:", ServerTx);
        if (!ServerTx.success) {
            Utils.displayToast("Error sending transaction");
            return false;
        }
        Utils.displayToast("Transaction sent successfully, waiting for confirmation");
        feeSpendbundleJoin.value = "0";


        return true;
    } catch (error) {
        console.error("Error in joinPlayer1FromGoby:", error);
        return false;
    }
}

async function revealSelectionPlayer1(){
    //TODO: add fee implementation from goby
    if(selectedOptionReveal.value == "" || keyRPS.value == "" ){
        Utils.displayToast("Select a Rock,Paper or Scissors and enter the Secret key");
        return;
    }

    const gobyCoinSpends = [];
    let solution = await UserSession.createSolutionRevealGame(parseInt(selectedOptionReveal.value), keyRPS.value, gamedetail.gameAmount);
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
    const gameSmartCoin = new greenweb.SmartCoin({
        parentCoinInfo: gamedetail.parentCoinId,
        puzzleHash: gamedetail.puzzleHash,
        amount: gamedetail.gameAmount,
    });
    const gameCoinId =  gameSmartCoin.getName();
    let ServerTx = await UserSession.revealSelectionPlayer1(coinId,parseInt(selectedOptionReveal.value),keyRPS.value,signature)
    console.log("ServerTx:", ServerTx);
    if (!ServerTx.success) {
        Utils.displayToast(ServerTx.message);
        return false;
    }
    Utils.displayToast("Transaction sent successfully");
    selectedOptionReveal.value = "";
    keyRPS.value = "";
    
}
async function claimGame(){
    if(feeSpendbundleClaim.value == "" ){
        Utils.displayToast("Enter a fee to claim the game");
        return;
    }
    try {
        let fee = Utils.XCHToMojos(parseFloat(feeSpendbundleClaim.value));   
        const gobyCoinSpends = [];
        if ( fee > gamedetail.gameAmount){
            Utils.displayToast("Fee can't be higher than the game amount");
            return false;
            
        }
       
        let solution = await UserSession.createSolutionClaimGame(gamedetail.gameAmount, fee);
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
        const gameSmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: gamedetail.parentCoinId,
            puzzleHash: gamedetail.puzzleHash,
            amount: gamedetail.gameAmount,
        });
        const gameCoinId =  gameSmartCoin.getName();
        let ServerTx = await UserSession.claimGame(gameCoinId, fee, signature);
        console.log("ServerTx:", ServerTx);
        if (!ServerTx.success) {
            Utils.displayToast(ServerTx.message);
            return false;
        }
        Utils.displayToast("Transaction sent successfully");
        feeSpendbundleClaim.value = "";
        return true;
    } catch (error) {
        console.error("Error in close game:", error);
        return false;
    }
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
async function checkPendingTransaction() {
    let coinId = window.location.pathname.split("/").pop();
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
                        <h6 class="card-title mb-2 text-white">transaction completed</h6>
                    </div>
                    </div>
                </div>
            </div>
        `;
        
        // Actualizar manejador del botón de cerrar
        existingCard.querySelector('.btn-close').addEventListener('click', () => existingCard.remove());
        return; // No necesitamos seguir monitoreando
    }


}
function selectOption(value, element) {
    document
        .querySelectorAll(".rps-option")
        .forEach((el) => el.classList.remove("selected"));
    element.classList.add("selected");
    selectedOption = value;
}
function selectOptionReveal(value, element) {
    document
        .querySelectorAll(".rps-option-reveal")
        .forEach((el) => el.classList.remove("selected"));
    element.classList.add("selected");
    document.getElementById("selectedOptionReveal").value = value;
    checkCompromise();
}
function setFeeClaimSelector(){
    if (!window.feeSelectorClaim) {
        window.feeSelectorClaim = new FeeSelector([{ fee: "0", time: -1 }], UserSession.prefix, "feeClaimSelectorContainer");
        window.feeSelectorClaim.on("change", (data) => {
            feeSpendbundleClaim.value = data.value;
        });
        window.feeSelectorClaim.on("timerFinished", () => {
            console.log("Temporizador terminado, actualizando tarifas...");
        });
    }
}
function setFeeCloseSelector(){
    if (!window.feeSelectorClose) {
        window.feeSelectorClose = new FeeSelector([{ fee: "0", time: -1 }], UserSession.prefix);
        window.feeSelectorClose.on("change", (data) => {
            feeSpendbundle.value = data.value;
        });
        window.feeSelectorClose.on("timerFinished", () => {
            console.log("Temporizador terminado, actualizando tarifas...");
        });
    }
}
async function setConfigReveal(){
    if (window.configRevealInitialized) {
        return;
    }
    window.configRevealInitialized = true;
    jsonFileName.innerHTML = gamedetail.compromisePlayer1+".json";
    const secretKey = document.getElementById("keyRPS");
    const selectedOptionReveal = document.getElementById("selectedOptionReveal");
    let PlayerRevealStorge = localStorage.getItem(gamedetail.compromisePlayer1);
    let PlayerReveal = null;
    if (PlayerRevealStorge){
        PlayerReveal = JSON.parse(PlayerRevealStorge);
        secretKey.value = PlayerReveal.secretKey;
        const selectedOptionElement = document.querySelector(`.rps-option-reveal[data-value="${PlayerReveal.selection.value}"]`);
        if (selectedOptionElement) {
            selectOptionReveal(PlayerReveal.selection.value, selectedOptionElement);
            await checkCompromise();
        }
    }
    else{
        jsonFileContainer.style.display = "block";
        
    }
    secretKey.addEventListener("input", async () => {
        await checkCompromise();
    });
    selectedOptionReveal.addEventListener("input", async () => {
        await checkCompromise();
    });

}
async function handleFileUploadReveal(event) {
    const file = event.target.files[0];
    const secretKey = document.getElementById("keyRPS");
    const selectedOptionReveal = document.getElementById("selectedOptionReveal");
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const PlayerReveal = JSON.parse(e.target.result);
            secretKey.value = PlayerReveal.secretKey;
            const selectedOptionElement = document.querySelector(`.rps-option-reveal[data-value="${PlayerReveal.selection.value}"]`);
            if (selectedOptionElement) {
                selectOptionReveal(PlayerReveal.selection.value, selectedOptionElement);
                await checkCompromise();
            }
        };
        reader.readAsText(file);
    }
}