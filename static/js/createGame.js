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
    gameWalletInfo = await UserSession.getWalletInfo();
    walletAddress.innerHTML = UserSession.walletAddress;
    playerPubKey.innerHTML = UserSession.pubkey;
    document.querySelectorAll(".currency").forEach((element) => {
        element.innerHTML = UserSession.prefix.toUpperCase();
    });
    const feeOptions = [
        { fee: "0", time: -1 },
        { fee: "0.000000000001", time: 1 },
        { fee: "0.000000000002", time: 2 }
    ];

    const feeSelector = new FeeSelector(feeOptions, UserSession.prefix);

    feeSelector.on("change", (data) => {
        feeSpendbundle.value = data.value;
        validateBalance();
    });

    feeSelector.on("timerFinished", () => {
        console.log("Temporizador terminado, actualizando tarifas...");
        // Aquí puedes actualizar las tarifas
        // Por ejemplo:
        // updateFees().then(newFees => feeSelector.updateOptions(newFees));
        //TODO: UPDATE FEE
    });

    setBalance();
    setTimeout(() => {
        //getPendingTransactions();
    }, 2000);
    setInterval(() => {
        setBalance();
        //getPendingTransactions();
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
        if (!Response.success && Response.pendingTransaction.length == 0) {
            continue;
        }

        Response.pendingTransaction.forEach((transaction) => {
            const option = {
                value: transaction.spend_bundle.coin_spends[0].coin
                    .parent_coin_info
            };
            const card = `
                <div class="card cardWhite">
                    <div class="card-title">Pending Transaction</div>
                    <div class="card-content">
                        <strong>Coin ID:</strong> ${option.value}<br>
                        <strong>Coin Amount:</strong> ${Utils.formatMojosPrefix(
                            transaction.spend_bundle.coin_spends[0].coin.amount,
                            IS_MAINNET
                        )}<br>
                        <strong>Fee:</strong> ${Utils.formatMojos(
                            transaction.fee
                        )}<br>
                        <strong>Action:</strong> ${Response.action}
                    </div>
                    <button class="card-button" id="${option.value}">💾</button>
                </div>
            `;
            pendingTransactions.innerHTML += card;
            document
                .getElementById(option.value)
                .addEventListener("click", async () => {
                    Utils.downloadJson(option.value, transaction.spend_bundle);
                });
        });
    }
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
    //Tenemos que mandar el monto a la wallet game alias launcher, en este mismo spendbundle,
    //debemos de armar el coinspend del wallet game que se creara y se gastara en la misma transaccion
    //mandando otro coinspend que el de Game que sse gastara tambien para poder poder su jugada
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
    if (!join) {
        Utils.displayToast("Error joining the game");
        return;
    }
    saveSelectionData();
    keyRPS.value = "";
    selectionRPSHash.value = "";
    feeSpendbundle.value = "0";
    betAmount.value = "";
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
        // 1. Seleccionar coins y crear gobyCoinSpends (esta parte está bien)
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

        // Usar la solución que viene del backend
        let concatenatedSolution = await UserSession.concat([
            1, // ACTION_JOIN_PLAYER1
            gameWalletPuzzleHash,
            betAmount,
            0,
            gameWalletInfo.game_puzzle_hash,
            betAmount,
            selectionHash,
            cashOutAddressHash,
            gameWalletInfo.oracle_puzzle_hash
        ]);
       
        let solutionJoinPlayer1 = await UserSession.createSolutionJoinPlayer1(gameWalletPuzzleHash,betAmount,selectionHash,cashOutAddressHash);
        // Crear el coin spend usando la solución del backend
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

        // 3. Crear el Game coin
        const gameWalletCoinId = gameWalletSmartCoin.getName();
        const gameSmartCoin = new greenweb.SmartCoin({
            parentCoinInfo: gameWalletCoinId,
            puzzleHash: gameWalletInfo.game_puzzle_hash,
            amount: betAmount
        });

        

        const gameCoinSpend = {
            coin: {
                // Añadir el objeto coin dentro de una propiedad coin
                parent_coin_info: "0x" + gameWalletCoinId,
                puzzle_hash: "0x" + gameWalletInfo.game_puzzle_hash,
                amount: betAmount
            },
            puzzle_reveal: gameWalletInfo.game_puzzle_reveal,
            solution: solutionJoinPlayer1.solutionGame
        };
        // let messageToSign = await UserSession.concat([
        //     1, // Action
        //     betAmount,
        //     fee,
        //     gameWalletInfo.game_puzzle_hash,
        //     selectionHash,
        //     cashOutAddressHash,
        //     gameWalletInfo.oracle_puzzle_hash
        // ]);
        // let sha256Message = await UserSession.sha256Hex(messageToSign);
        // let gameWalletSignature = await UserSession.Goby.signMessage(
        //     sha256Message,
        //     UserSession.pubkey
        // );
        // 4. Combinar los coin spends y crear el spend bundle
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
        let spend = await UserSession.pushTx(spendBundle);
        console.log("spend", spend);
        return await UserSession.Goby.sendTransaction(spendBundle);
    } catch (error) {
        console.error("Error in joinPlayer1FromGoby:", error);
        return false;
    }
}
