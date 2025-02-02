let UserSession = new Session();
const coinId = window.location.pathname.split("/").pop();
let coinRecord;
let IntervalTx = null;
let GameAmount = 0;
let selectedOption = null;
let poolingGameDetailsController = null;
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
        CloseGameContainer.style.display = "none";
        JoinGameContainer.style.display = "none";
        RevealGameContainer.style.display = "none";
        setFeeClaimSelector();
        return;
    }

    if (gamedetail?.spentBlockIndex == 0 && gamedetail.stage == 2  && gamedetail.publicKeyPlayer1 == UserSession.pubkey?.replace("0x","") ){
        CloseGameContainer.style.display = "block";
        JoinGameContainer.style.display = "none";
        RevealGameContainer.style.display = "none";
        ClaimGameContainer.style.display = "none";
        setFeeCloseSelector();
    }
    if (gamedetail?.spentBlockIndex == 0 && gamedetail.stage == 3 && UserSession.pubkey && UserSession.pubkey?.replace("0x","") == gamedetail.publicKeyPlayer1){
        RevealGameContainer.style.display = "block";
        CloseGameContainer.style.display = "none";
        JoinGameContainer.style.display = "none";
        ClaimGameContainer.style.display = "none";
        setConfigReveal();
    }

    if (gamedetail?.spentBlockIndex == 0 && gamedetail.stage == 2 && UserSession.pubkey && UserSession.pubkey?.replace("0x","") != gamedetail.publicKeyPlayer1){
        JoinGameContainer.style.display = "block";
        CloseGameContainer.style.display = "none";
        RevealGameContainer.style.display = "none";
        ClaimGameContainer.style.display = "none";
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


async function getGameDetails(showSpinner = false,signal = null){
    const RgameInfo = await Utils.getGameDetails(coinId,showSpinner,signal);
    if (!RgameInfo.success){
        return;
    }
    window.gamedetail = RgameInfo.game;
    if ( RgameInfo.game.spentBlockIndex != 0){
        if (poolingGameDetailsController) {
            poolingGameDetailsController.abort();
            poolingGameDetailsController = null;
        }
    }
    else if (RgameInfo.game.spentBlockIndex == 0 && !poolingGameDetailsController) {
        startPoolingGameDetails();
    }

    GameAmount = RgameInfo.game.gameAmount;
    const date = new Date(gamedetail.timestamp * 1000);
    const formattedDate = date.toLocaleString();
    coinDate.innerHTML = formattedDate;
    coinAmount.innerHTML = Utils.formatMojosPrefix(GameAmount,IS_MAINNET);
    document.querySelectorAll('.coinAmount').forEach(element => {
        element.innerHTML = Utils.formatMojosPrefix(GameAmount, IS_MAINNET);
    });
    Player1.innerHTML = `<a href="/userProfile/${gamedetail.publicKeyPlayer1}">${gamedetail.namePlayer1 == gamedetail.publicKeyPlayer1 ? "Player 1":gamedetail.namePlayer1}</a>`;
    Player2.innerHTML = `<a href="${gamedetail.namePlayer2 == "----" || gamedetail.namePlayer2 ==""?"#":"/userProfile/"+gamedetail.publicKeyPlayer2}">${gamedetail.namePlayer2 =="----" || gamedetail.namePlayer2 =="" ? "----":gamedetail.namePlayer2 == gamedetail.publicKeyPlayer2 ? "Player 2":gamedetail.namePlayer2}</a>`;
    selectionPlayer1.title = "Compromise : "+gamedetail.compromisePlayer1;
    selectionPlayer1.innerHTML = gamedetail.emojiSelectionPlayer1;
    selectionPlayer2.innerHTML = gamedetail.emojiSelectionPlayer2;
    
    contractCode.textContent = RgameInfo.game.puzzleRevealFormatted;
    puzzleReveal.textContent = RgameInfo.game.puzzleReveal;
    puzzleDisassembled.textContent = RgameInfo.game.puzzleRevealDisassembled;
    Prism.highlightAll();
    coinAmount.title = "Game Puzzle Hash: "+gamedetail.puzzleHash;
    coinStatus.innerHTML = gamedetail.coinStatus;


    document.getElementById('spinnerPendingTransaction').style.display = RgameInfo.pendingTransactions.isPending == 1 ? "block":"none";


    gameStatusDescription.innerHTML = RgameInfo.pendingTransactions.isPending == 1 ? RgameInfo.pendingTransactions.action:RgameInfo.game.gameStatusDescription;
    if(gamedetail.publicKeyWinner != "" && gamedetail.publicKeyWinner == gamedetail.publicKeyPlayer1)
        winnerIconP1.innerHTML = "<i class='fas fa-trophy'></i>";
    if(gamedetail.publicKeyWinner != "" &&  gamedetail.publicKeyWinner == gamedetail.publicKeyPlayer2)
        winnerIconP2.innerHTML = "<i class='fas fa-trophy'></i>";
    let htmlContent = '';
    RgameInfo.gameCoins.forEach((coin, index) => {
        if (index === RgameInfo.gameCoins.length - 1) {
            return;
        }
        htmlContent += `<div class="progress-step text-center d-flex flex-column align-items-center mx-4">
        <div class="progress-circle bg-${coin.coinStatus == "SPENT" ? "success":"warning"} mb-3 d-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
            <i class="fas fa-${coin.coinStatus == "SPENT" ? "check":"clock"} fa-lg"></i>
        </div>
        <div class="text-white-50 text-center" style="max-width: 120px; overflow-wrap: break-word; white-space: normal; line-height: 1.4;">
            ${coin.gameStatusDescription}
        </div>
    </div>`;
    });
    gameCoins.innerHTML = htmlContent
    if(gamedetail.spentBlockIndex != 0 || RgameInfo.pendingTransactions.isPending == 1){
        CloseGameContainer.style.display = "none";
        JoinGameContainer.style.display = "none";
        RevealGameContainer.style.display = "none";
        ClaimGameContainer.style.display = "none";
    }
    if(gamedetail.spentBlockIndex != 0){
        clearInterval(IntervalTx);
        IntervalTx = null;
    }
    //Claim Player 2
    if (gamedetail.spentBlockIndex == 0  && RgameInfo.pendingTransactions.isPending == 0 && gamedetail.stage == 3 && gamedetail.publicKeyPlayer2 ==  UserSession.pubkey?.replace("0x","")){
        ClaimGameContainer.style.display = "block";
        setFeeClaimSelector();
        return;
    }
    if (gamedetail.spentBlockIndex == 0 && RgameInfo.pendingTransactions.isPending == 0 && gamedetail.stage == 2  && gamedetail.publicKeyPlayer1 == UserSession.pubkey?.replace("0x","") ){
        CloseGameContainer.style.display = "block";
        setFeeCloseSelector();

    }
    //Reveal Player 1
    if (gamedetail.spentBlockIndex == 0 && RgameInfo.pendingTransactions.isPending == 0 && gamedetail.stage == 3 && UserSession.pubkey && UserSession.pubkey?.replace("0x","") == gamedetail.publicKeyPlayer1){
        RevealGameContainer.style.display = "block";
        setConfigReveal();
    }
    //Join Player 2
    if (gamedetail.spentBlockIndex == 0 && RgameInfo.pendingTransactions.isPending == 0 && gamedetail.stage == 2 && UserSession.pubkey && UserSession.pubkey?.replace("0x","") != gamedetail.publicKeyPlayer1){
        JoinGameContainer.style.display = "block";
        if(IntervalBalance == null){
            setBalance();
            IntervalBalance = setInterval(() => {
                setBalance();
            }, 30000);
        }
    }
    return;
}

async function closeGame(){
    
    try {
        let fee = Utils.XCHToMojos(parseFloat(feeSpendbundle.value));   
        if ( fee > gamedetail.gameAmount){
            Utils.displayToast("Fee can't be higher than the game amount");
            return false;
            
        }
        Utils.showSpinner("Connecting to Goby...");
        
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
        if (poolingGameDetailsController) {
            poolingGameDetailsController.abort();
            poolingGameDetailsController = null;
        }
        let ServerTx = await UserSession.closeGame(gameCoinId, fee, signature);
        Utils.hideSpinner();
        if (poolingGameDetailsController) {
            poolingGameDetailsController.abort();
            poolingGameDetailsController = null;
        }
        startPoolingGameDetails();
        console.log("ServerTx:", ServerTx);
        if (!ServerTx.success) {
            Utils.displayToast(ServerTx.message);
            return false;
        }
        Utils.displayToast("Transaction sent successfully");
        feeSpendbundle.value = "0";
        document.getElementById('spinnerPendingTransaction').style.display = "block";
        
        return true;
    } catch (error) {
        Utils.hideSpinner();
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
        Utils.showSpinner("Connecting to Goby...");

        const gobyCoinSpends = await UserSession.Goby.createStandarCoinSpends(
            selectedCoins,
            gameWalletPuzzleHash,
            betAmount,
            change,
            fee
        );
        gobyCoinSpends.sort((a, b) => a.coin.amount - b.coin.amount);

        const highestCoinSpend = gobyCoinSpends.find(spend => spend.solution.includes(gameWalletPuzzleHash));
        console.log("Goby wallet parent coin:", highestCoinSpend);

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
       
        let solutionJoinPlayer2 = await UserSession.createSolutionJoinPlayer2(selectedOption, cashOutAddressHash, gamedetail.coinId);
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
        if (poolingGameDetailsController) {
            poolingGameDetailsController.abort();
            poolingGameDetailsController = null;
        }
        let ServerTx = await UserSession.joinPlayer2(spendBundle,coinId,gobySmartCoin.getName(),0,selectedOption,cashOutAddressHash,signature);
        Utils.hideSpinner();
        if (poolingGameDetailsController) {
            poolingGameDetailsController.abort();
            poolingGameDetailsController = null;
        }
        startPoolingGameDetails();
        console.log("ServerTx:", ServerTx);
        if (!ServerTx.success) {
            Utils.displayToast("Error sending transaction");
            return false;
        }
        Utils.displayToast("Transaction sent successfully, waiting for confirmation");
        feeSpendbundleJoin.value = "0";
        document.getElementById('spinnerPendingTransaction').style.display = "block";
        
        return true;
    } catch (error) {
        Utils.hideSpinner();
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
    Utils.showSpinner("Connecting to Goby...");
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
    if (poolingGameDetailsController) {
        poolingGameDetailsController.abort();
        poolingGameDetailsController = null;
    }
    let ServerTx = await UserSession.revealSelectionPlayer1(gamedetail.coinId,parseInt(selectedOptionReveal.value),keyRPS.value,signature)
    Utils.hideSpinner();
    if (poolingGameDetailsController) {
        poolingGameDetailsController.abort();
        poolingGameDetailsController = null;
    }
    startPoolingGameDetails();
    console.log("ServerTx:", ServerTx);
    if (!ServerTx.success) {
        Utils.displayToast(ServerTx.message);
        return false;
    }
    document.getElementById('spinnerPendingTransaction').style.display = "block";
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
        Utils.showSpinner("Connecting to Goby...");
       
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
        if (poolingGameDetailsController) {
            poolingGameDetailsController.abort();
            poolingGameDetailsController = null;
        }
        let ServerTx = await UserSession.claimGame(gameCoinId, fee, signature);
        Utils.hideSpinner();

        if (poolingGameDetailsController) {
            poolingGameDetailsController.abort();
            poolingGameDetailsController = null;
        }
        startPoolingGameDetails();
        console.log("ServerTx:", ServerTx);
        if (!ServerTx.success) {
            Utils.displayToast(ServerTx.message);
            return false;
        }
        Utils.displayToast("Transaction sent successfully");
        feeSpendbundleClaim.value = "";
        document.getElementById('spinnerPendingTransaction').style.display = "block";
        
        return true;
    } catch (error) {
        Utils.hideSpinner();
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
async function startPoolingGameDetails() {
    if (poolingGameDetailsController) {
        poolingGameDetailsController.abort();
    }

    poolingGameDetailsController = new AbortController();
    const signal = poolingGameDetailsController.signal;

    try {
        while (!signal.aborted) {
            const startTime = Date.now();
            await getGameDetails(false,signal);
            
            if (signal.aborted) break;

            const executionTime = Date.now() - startTime;
            const remainingTime = Math.max(10000 - executionTime, 0);
            
            try {
                await new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(resolve, remainingTime);
                    signal.addEventListener('abort', () => {
                        clearTimeout(timeoutId);
                        reject(new Error('Pooling aborted'));
                    });
                });
            } catch (error) {
                if (error.message === 'Pooling aborted') break;
                throw error;
            }
        }
    } catch (error) {
        console.error('Error en pooling:', error);
    }
}