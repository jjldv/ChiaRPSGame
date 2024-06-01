let UserSession = new Session();
IS_MAINNET = null;

document.addEventListener("DOMContentLoaded", async function () {
    

    didCmdSingature.innerHTML = UserSession.DID;
    playerDID.innerHTML = UserSession.DID;
    walletAddress.innerHTML = UserSession.walletAddress;
    walletPuzzleHash.innerHTML = UserSession.walletPuzzleHash;
    walletPuzzleReveal.innerHTML = UserSession.walletPuzzleReveal;
    walletPuzzleRevealDisassembled.innerHTML = UserSession.walletPuzzleRevealDisassembled;
    gamePuzzleReveal.innerHTML = UserSession.gamePuzzleReveal;
    gamePuzzleRevealDisassembled.innerHTML = UserSession.gamePuzzleRevealDisassembled;
    playerPubKey.innerHTML = UserSession.pubkey;
    cashOutAddress.value = UserSession.cashOutAddress??"";
    getBalance();
    setTimeout(() => {
        getPendingTransactions();
    }, 2000);
    setInterval(() => {
        getBalance();
        getPendingTransactions();
    }, 30000);
    
    coinIdSelect.addEventListener("change", async () => {
        await setInitialBetAmountAndFee();
        setCmdMessageSignature();
    });
    
    feeSpendbundle.addEventListener("change", async () => {
        await updateBetAmount();
        setCmdMessageSignature();

    });
    cashOutAddress.addEventListener("change", async () => {
        setCmdMessageSignature();
    });
    betAmount.addEventListener("change", async () => {
        await updateFee();
        setCmdMessageSignature();

    });
    RPSSelect.addEventListener("change", async () => {
        await setSelectionRPSHash();
        setCmdMessageSignature();
    });
    keyRPS.addEventListener("change", async () => {
        await setSelectionRPSHash();
        setCmdMessageSignature();
    });
});
async function setSelectionRPSHash(){
    selectionRPSHash.value = "";
    if(RPSSelect.value == "" || keyRPS.value == "" ){
        return;
    }
    const concatSelectWithKey = await UserSession.concat([parseInt(RPSSelect.value), keyRPS.value]);
    const sha256Message = await UserSession.sha256Hex(concatSelectWithKey);
    selectionRPSHash.value = sha256Message;
}
async function updateFee(){
    if(coinIdSelect.value == "" || feeSpendbundle.value == "" || betAmount.value == "" ){
        return;
    }
    const currentBetAmount = Utils.XCHToMojos(parseFloat(betAmount.value));
    const currentFee = Utils.XCHToMojos(parseFloat(feeSpendbundle.value));
    const selectedCoinAmount = parseInt(coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount);
    const newChangeAmount = (selectedCoinAmount - currentBetAmount - currentFee);
    amountChangeCoin.innerHTML = Utils.formatMojos(newChangeAmount); 
}
async function updateBetAmount(){
    if(coinIdSelect.value == "" || feeSpendbundle.value == "" || betAmount.value == "" ){
        return;
    }
    const currentBetAmount = Utils.XCHToMojos(parseFloat(betAmount.value));
    const currentFee = Utils.XCHToMojos(parseFloat(feeSpendbundle.value));
    const selectedCoinAmount = parseInt(coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount);
    const newChangeAmount = (selectedCoinAmount - currentBetAmount - currentFee);
    amountChangeCoin.innerHTML = Utils.formatMojos(newChangeAmount);    
}
async function getPendingTransactions() {
        
    let rows = "";
    pendingTransactions.innerHTML = "";
    for (let i = 0; i < coinIdSelect.options.length; i++) {
        const option = coinIdSelect.options[i];
        const coinId = option.value;
        if (coinId === "") {
            continue;
        }   
        const Response = await Utils.getCoinPendingTransaction(coinId);
        if (!Response.success && Response.pendingTransaction.length ==0) {
            continue;
        }
       
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
}
async function setInitialBetAmountAndFee(){
    didCmdMessageSingature.innerHTML = "";
    signatureSpendbundle.value = "";
    betAmount.value = "";
    feeSpendbundle.value = "0";
    if(coinIdSelect.value == ""  ){
        return;
    }
    const fee = await UserSession.getFeeEstimateJoinPlayer1(coinIdSelect.value,0,coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount);
    feeSpendbundle.value = Utils.formatMojos(fee);
    const betInMojos = coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount - fee;
    betAmount.value = Utils.formatMojos(betInMojos);
    const changeInMojos = coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount - betInMojos - fee;
    amountChangeCoin.innerHTML = Utils.formatMojos(changeInMojos);
}

async function setCmdMessageSignature(){
    didCmdMessageSingature.innerHTML = "";
    signatureSpendbundle.value = "";
    if(coinIdSelect.value == "" || feeSpendbundle.value == ""  || betAmount.value == ""|| selectionRPSHash.value == "" || cashOutAddress.value == ""){
        return;
    }
    let walletAddressPuzzleHash = await Utils.convertAddressToPuzzleHash(
        cashOutAddress.value
    );
    const gametPuzzleHash = UserSession.gamePuzzleHash;
    const oraclePuzzleHash = UserSession.oraclePuzzleHash;
    const concatMessage2Sign = await UserSession.concat([1,Utils.XCHToMojos(parseFloat(betAmount.value)), Utils.XCHToMojos(parseFloat(feeSpendbundle.value)), "0x"+gametPuzzleHash, "0x"+selectionRPSHash.value, "0x"+walletAddressPuzzleHash, "0x"+oraclePuzzleHash]);
    const sha256Message = await UserSession.sha256Hex(concatMessage2Sign);
    if (!sha256Message) {
        Utils.displayToast("Error sha256");
        return;
    }
    let message = `${sha256Message}${coinIdSelect.value}${UserSession.genesisChallenge}`;
    didCmdMessageSingature.innerHTML = message;
}

async function getBalance() {
    let walletBalanceInfo = await UserSession.getWalletBalance();
    if (walletBalanceInfo.success) {
        IS_MAINNET = walletBalanceInfo.isMainnet;
        walletBalance.innerHTML = Utils.formatMojosPrefix(walletBalanceInfo.balance,walletBalanceInfo.isMainnet);
        numberCoins.innerHTML = walletBalanceInfo.coins.filter(coin => coin.amount > 0).length;
        let existingCoins = Array.from(coinIdSelect.options).map((option) => option.value);
        let selectedCoinId = coinIdSelect.value; 

        walletBalanceInfo.coins.forEach((coin) => {
            if (!existingCoins.includes(coin.coin_id) && coin.amount > 0) {
                let option = document.createElement("option");
                option.value = coin.coin_id;
                option.dataset.amount = coin.amount;
                option.text = Utils.formatMojosPrefix(coin.amount,walletBalanceInfo.isMainnet) + " - Coin ID: " + coin.coin_id;
                coinIdSelect.appendChild(option);
            }
        });

        Array.from(coinIdSelect.options).forEach((option) => {
            if (!walletBalanceInfo.coins.some((coin) => coin.coin_id === option.value) && option.value != "") {
                console.log("Removing coin from select: ", option.value);
                coinIdSelect.removeChild(option);
            }
        });
        if (!Array.from(coinIdSelect.options).some((option) => option.value === selectedCoinId)) {
            coinIdSelect.value = "";
        }
        else {
            coinIdSelect.value = selectedCoinId;
        }
    }
}

async function joinPlayer1() {
    if (!coinIdSelect.value || coinIdSelect.value == "") {
        Utils.displayToast("Select a coin to create game");
        return;
    }
    if (!feeSpendbundle.value || feeSpendbundle.value == "") {
        Utils.displayToast("Enter a fee to create game");
        return;
    }
    if (!selectionRPSHash.value) {
        Utils.displayToast("Enter your selection to play");
        return;
    }
    if (!signatureSpendbundle.value) {
        Utils.displayToast("Enter a signature to create game");
        return;
    }
    if (!isHexStringValid(signatureSpendbundle.value)) {
        Utils.displayToast("The signature is not a valid hex string");
        return;
    }
    if(cashOutAddress.value == ""){
        Utils.displayToast("Enter a wallet address to create game");
        return;
    }
    let walletAddressPuzzleHash = await Utils.convertAddressToPuzzleHash(
        cashOutAddress.value
    );
    if(walletAddressPuzzleHash == null){
        Utils.displayToast("Invalid wallet address");
        return;
    }
    UserSession.setCashOutAddress(cashOutAddress.value);
    const RopenGame =  await UserSession.joinPlayer1(coinIdSelect.value,Utils.XCHToMojos(parseFloat(feeSpendbundle.value)),Utils.XCHToMojos(parseFloat(betAmount.value)),selectionRPSHash.value,walletAddressPuzzleHash,signatureSpendbundle.value);
    Utils.displayToast(RopenGame.message);
    if(RopenGame.success)
    {
        getPendingTransactions();
    }
    signatureSpendbundle.value = "";
    RPSSelect.value = "";
    keyRPS.value = "";
    selectionRPSHash.value = "";
    coinIdSelect.value = "";
    feeSpendbundle.value = "0";
    betAmount.value = "";
    didCmdMessageSingature.innerHTML = "";
    
}
function isHexStringValid(hexString) {
    if (hexString.length % 2 !== 0) {
        return false;
    }
    return /^[0-9A-Fa-f]{2,}$/.test(hexString);
}
