let UserSession = new Session();
let selectedOption = null;
IS_MAINNET = null;
var tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-mdb-toggle="tooltip"]')
);
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new mdb.Tooltip(tooltipTriggerEl);
});
//TODO: change name for LauncherGame to get the control of the games for the user
let gameWalletInfo;

UserSession.on("connected", async () => {
    const netWorkInfo = await Utils.fetch("/getNetworkInfo");
    IS_MAINNET = netWorkInfo.success && netWorkInfo.network_name === "mainnet";
    gameWalletInfo = await UserSession.getWalletInfo();
    walletAddress.innerHTML = UserSession.walletAddress;
    playerPubKey.innerHTML = UserSession.pubkey;
    document.querySelectorAll(".currency").forEach((element) => {
        element.innerHTML = UserSession.prefix.toUpperCase();
    });
    const feeOptions = [
        { fee: "0", time: -1 },
    ];

    const feeSelector = new FeeSelector(feeOptions, UserSession.prefix);

    feeSelector.on("change", (data) => {
        feeSpendbundle.value = data.value;
        validateBalance();
    });

    feeSelector.on("timerFinished", () => {
        console.log("Temporizador terminado, actualizando tarifas...");
        //TODO: UPDATE FEE
    });

    setBalance();
    setInterval(() => {
        setBalance();
    }, 30000);

    keyRPS.addEventListener("change", async () => {
        await setSelectionRPSHash();
    });
    document
        .getElementById("betAmount")
        .addEventListener("input", validateBalance);
    document
        .getElementById("feeSpendbundle")
        .addEventListener("input", validateBalance);
});
async function setSelectionRPSHash() {
    selectionRPSHash.value = "";
    if (selectedOption == "" || keyRPS.value == "") {
        return;
    }
    const concatSelectWithKey = await UserSession.concat([
        parseInt(selectedOption),
        keyRPS.value
    ]);
    const sha256Message = await UserSession.sha256Hex(concatSelectWithKey);
    selectionRPSHash.value = sha256Message;
}
async function setInitialBetAmountAndFee() {
    didCmdMessageSingature.innerHTML = "";
    signatureSpendbundle.value = "";
    betAmount.value = "";
    feeSpendbundle.value = "0";
    if (coinIdSelect.value == "") {
        return;
    }
    const fee = await UserSession.getFeeEstimateJoinPlayer1(
        coinIdSelect.value,
        0,
        coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount
    );
    feeSpendbundle.value = Utils.formatMojos(fee);
    const betInMojos =
        coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount - fee;
    betAmount.value = Utils.formatMojos(betInMojos);
    const changeInMojos =
        coinIdSelect.options[coinIdSelect.selectedIndex].dataset.amount -
        betInMojos -
        fee;
    amountChangeCoin.innerHTML = Utils.formatMojos(changeInMojos);
}
async function setBalance() {
    const balance = await UserSession.getWalletBalance();
    walletBalance.innerHTML = Utils.formatMojosPrefix(
        balance.spendable,
        UserSession.network == "mainnet"
    );
}
async function joinPlayer1() {
    if (!feeSpendbundle.value || feeSpendbundle.value == "") {
        Utils.displayToast("Enter a fee to create game");
        return;
    }
    if (!betAmount.value || betAmount.value == "") {
        Utils.displayToast("Enter a bet amount to create game");
        return;
    }
    if (!selectionRPSHash.value) {
        Utils.displayToast("Enter your selection to play");
        return;
    }
    if (!keyRPS.value) {
        Utils.displayToast("Enter a key to compronise your selection");
        return;
    }
    if (!selectionRPSHash.value) {
        Utils.displayToast("Enter your selection to play");
        return;
    }
    let join = await joinPlayer1FromGoby(
        gameWalletInfo.wallet_address,
        Utils.XCHToMojos(parseFloat(betAmount.value)),
        Utils.XCHToMojos(parseFloat(feeSpendbundle.value)),
        selectionRPSHash.value,
        UserSession.walletPuzzleHash
    );
    
}
function selectOption(value, element) {
    document
        .querySelectorAll(".rps-option")
        .forEach((el) => el.classList.remove("selected"));
    element.classList.add("selected");
    selectedOption = value;
    generateRandomKey();
    setSelectionRPSHash();
}
function generateRandomKey() {
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < 16; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
        );
    }
    document.getElementById("keyRPS").value = result;
    setSelectionRPSHash(); // Asumiendo que esta función ya existe para actualizar el hash
}
function saveSelectionData() {
    const selectionValue = selectedOption;
    const secretKey = document.getElementById("keyRPS").value;
    const selectionHash = document.getElementById("selectionRPSHash").value;

    if (!selectionValue || !secretKey || !selectionHash) {
        Utils.displayToast(
            "Please make sure you have selected an option, entered a secret key, and generated a selection hash before saving."
        );
        return;
    }

    const selectionLabels = {
        1: "Rock",
        2: "Paper",
        3: "Scissors"
    };

    const data = {
        selection: {
            value: selectionValue,
            label: selectionLabels[selectionValue]
        },
        secretKey: secretKey,
        selectionHash: selectionHash
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectionHash}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Utils.displayToast("Selection data saved successfully!");
}
async function validateBalance() {
    const betAmountXCH =
        parseFloat(document.getElementById("betAmount").value) || 0;
    const networkFeeXCH =
        parseFloat(document.getElementById("feeSpendbundle").value) || 0;
    if (isNaN(parseFloat(document.getElementById("betAmount").value))) {
        document.getElementById("balanceValidationMessage").textContent =
            "Please enter a valid bet amount";
        document.getElementById("balanceValidationMessage").style.color = "red";
        return;
    }
    if (betAmountXCH == 0) {
        document.getElementById("balanceValidationMessage").textContent =
            "Please enter a bet amount";
        document.getElementById("balanceValidationMessage").style.color = "red";
        return;
    }
    if (betAmountXCH < 0 || networkFeeXCH < 0) {
        document.getElementById("balanceValidationMessage").textContent =
            "Amounts cannot be negative.";
        document.getElementById("balanceValidationMessage").style.color = "red";
        return;
    }

    const betAmountMojos = Math.floor(betAmountXCH * 1e12);
    const networkFeeMojos = Math.floor(networkFeeXCH * 1e12);
    const totalAmountMojos = betAmountMojos + networkFeeMojos;

    const walletBalance = await UserSession.getWalletBalance();
    document.getElementById("walletBalance").innerHTML =
        Utils.formatMojosPrefix(
            walletBalance.spendable,
            UserSession.network == "mainnet"
        );
    const spendableBalanceMojos = BigInt(walletBalance.spendable);

    const balanceValidationMessage = document.getElementById(
        "balanceValidationMessage"
    );

    function formatXCH(mojos) {
        const xch = Number(mojos) / 1e12;
        return xch
            .toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 12
            })
            .replace(/\.?0+$/, "");
    }

    if (BigInt(totalAmountMojos) > spendableBalanceMojos) {
        const deficitMojos = BigInt(totalAmountMojos) - spendableBalanceMojos;
        balanceValidationMessage.textContent = `Insufficient balance. You need ${formatXCH(
            totalAmountMojos
        )} XCH, but only have ${formatXCH(
            spendableBalanceMojos
        )} XCH available. Deficit: ${formatXCH(deficitMojos)} XCH.`;
        balanceValidationMessage.style.color = "red";
    } else {
        const remainingMojos = spendableBalanceMojos - BigInt(totalAmountMojos);
        balanceValidationMessage.textContent = `Balance sufficient. ${formatXCH(
            remainingMojos
        )} XCH will remain after bet and fees.`;
        balanceValidationMessage.style.color = "green";
    }
}

async function joinPlayer1FromGoby(
    toGameWalletAddress,
    betAmount,
    fee,
    selectionHash,
    cashOutAddressHash
) {
    try {
        const totalRequired = BigInt(betAmount) + BigInt(fee);
        console.log("Total required:", totalRequired.toString());
        let gameWalletPuzzleHash = gameWalletInfo.wallet_puzzle_hash;
        let changePuzzleHash = cashOutAddressHash;
        const { selectedCoins, totalSelected, change } =
            await UserSession.Goby.selectCoins(totalRequired);
        const gobyCoinSpends = await UserSession.Goby.createStandarCoinSpends(
            selectedCoins,
            gameWalletPuzzleHash,
            betAmount,
            changePuzzleHash,
            change,
            fee
        );
        const gobySmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: gobyCoinSpends[0].coin.parent_coin_info,
            puzzleHash: gobyCoinSpends[0].coin.puzzle_hash,
            amount: gobyCoinSpends[0].coin.amount
        });
        const gameWalletSmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: gobySmartCoin.getName(),
            puzzleHash: gameWalletPuzzleHash,
            amount: betAmount
        });
       
        let solutionJoinPlayer1 = await UserSession.createSolutionJoinPlayer1(gameWalletPuzzleHash,betAmount,selectionHash,cashOutAddressHash);
        const gameWalletCoinSpend = {
            coin: {
                // Añadir el objeto coin dentro de una propiedad coin
                parent_coin_info: "0x" + gameWalletSmartCoin.parentCoinInfo,
                puzzle_hash: "0x" + gameWalletInfo.wallet_puzzle_hash,
                amount: betAmount
            },
            puzzle_reveal: gameWalletInfo.wallet_puzzle_reveal,
            solution: solutionJoinPlayer1.solutionGameWallet
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
                parent_coin_info: "0x" + gameWalletCoinId,
                puzzle_hash: "0x" + gameWalletInfo.game_puzzle_hash,
                amount: betAmount
            },
            puzzle_reveal: gameWalletInfo.game_puzzle_reveal,
            solution: solutionJoinPlayer1.solutionGame
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
        let ServerTx = await UserSession.pushTx(spendBundle);
        console.log("ServerTx:", ServerTx);
        if (!ServerTx.success) {
            Utils.displayToast("Error sending transaction");
            return false;
        }
        Utils.displayToast("Transaction sent successfully, saving your selection data in json file...");
        saveSelectionData();
        keyRPS.value = "";
        selectionRPSHash.value = "";
        feeSpendbundle.value = "0";
        document.getElementById("betAmount").value = "";

        let GobyCoinId = gobySmartCoin.getName();
        setPendingTransaction(gameCoinId);
        return true;
    } catch (error) {
        console.error("Error in joinPlayer1FromGoby:", error);
        return false;
    }
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