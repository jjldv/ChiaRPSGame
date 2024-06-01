let UserSession = new Session();
IS_MAINNET = null;
document.addEventListener("DOMContentLoaded", async function () {
  

    didCmdSingature.innerHTML = UserSession.DID;
    playerDID.innerHTML = UserSession.DID;
    walletAddress.innerHTML = UserSession.walletAddress;
    walletPuzzleHash.innerHTML = UserSession.walletPuzzleHash;
    walletPuzzleReveal.innerHTML = UserSession.walletPuzzleReveal;
    walletPuzzleRevealDisassembled.innerHTML = UserSession.walletPuzzleRevealDisassembled;
    playerPubKey.innerHTML = UserSession.pubkey;
    cashOutAddress.value = UserSession.cashOutAddress??"";
    
    setInterval(async () => {
        await getBalance();
        getPendingTransactions();
    }, 30000);
    
    coinIdSelect.addEventListener("change", async () => {
        if(coinIdSelect.value != ""){
            await setFeeCashOut();
        }
    });
    
    cashOutAddress.addEventListener("change", async () => {
        setCmdCashOutSignature()
    });
    feeSpendbundle.addEventListener("change", async () => {
        setCmdCashOutSignature()
    });
    await getBalance();
    getPendingTransactions();
    
});
async function setFeeCashOut(){
    const Rfee = await UserSession.getFeeEstimateCashOut(coinIdSelect.value);
    feeSpendbundle.value = Utils.formatMojos(Rfee);
    setCmdCashOutSignature();
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

async function setCmdCashOutSignature(){
    didCmdMessageSingature.innerHTML = "";
    signatureSpendbundle.value = "";
    amountreceiveSpendbundle.innerHTML = "----";
    if(coinIdSelect.value == "" || cashOutAddress.value == "" || feeSpendbundle.value == ""){
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
    const concatMessage2Sign = await UserSession.concat([actionCashOut,betAmount, parseInt(Utils.XCHToMojos(feeSpendbundle.value)), "0x"+ walletAddressPuzzleHash]);
    const sha256Message = await UserSession.sha256Hex(concatMessage2Sign);
    if (!sha256Message) {
        Utils.displayToast("Error setting the sha256 to message to sign", "error");
        return;
    }
    let message = `${sha256Message}${coinIdSelect.value}${UserSession.genesisChallenge}`;
    didCmdMessageSingature.innerHTML = message;
    amountreceiveSpendbundle.innerHTML = Utils.formatMojosPrefix((coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount - Utils.XCHToMojos(feeSpendbundle.value)),IS_MAINNET)
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

async function cashOut() {
    if (!coinIdSelect.value || coinIdSelect.value == "") {
        Utils.displayToast("Select a coin to cash out");
        return;
    }
    if (!feeSpendbundle.value || feeSpendbundle.value == "") {
        Utils.displayToast("Enter a fee to cash out");
        return;
    }
    if (!cashOutAddress.value) {
        Utils.displayToast("Enter a wallet address to cash out");
        return;
    }
    if (!signatureSpendbundle.value) {
        Utils.displayToast("Enter a signature to cash out");
        return;
    }
    if (!isHexStringValid(signatureSpendbundle.value)) {
        Utils.displayToast("The signature is not a valid hex string");
        return;
    }
    let cashOutAddressPuzzleHash = await Utils.convertAddressToPuzzleHash(cashOutAddress.value);
    const RCashOut =  await UserSession.cashOut(coinIdSelect.value,cashOutAddressPuzzleHash,signatureSpendbundle.value,parseInt(Utils.XCHToMojos(feeSpendbundle.value)));
    signatureSpendbundle.value = "";
    coinIdSelect.value = "";
    feeSpendbundle.value = "0";
    amountreceiveSpendbundle.innerHTML = "----";
    setCmdCashOutSignature();
    if(RCashOut.success)
    {
        Utils.displayToast(RCashOut.message);
        getPendingTransactions();
        return;
    }
    Utils.displayToast("Error sending the spend bundle to the network" + RCashOut.message);
}
function isHexStringValid(hexString) {
    if (hexString.length % 2 !== 0) {
        return false;
    }
    return /^[0-9A-Fa-f]{2,}$/.test(hexString);
}
