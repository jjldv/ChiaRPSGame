
class Goby {
    constructor() {
        if (!window.chia) {
            Utils.displayToast("Goby Wallet no está disponible");
            return;
        }
        this.chiaWallet = window.chia;
        this.userInfo = null;
        this.isInitialized = false;
        this.handleAccountChanged = this.handleAccountChanged.bind(this);
        this.handleChainChanged = this.handleChainChanged.bind(this);
    }

    async initialize() {
        await this.setUserSession();
        this.setupEventListeners();
        await greenweb.clvm.initializeBLS();
    }
    setupEventListeners() {
        this.chiaWallet.on("accountChanged", this.handleAccountChanged);
        this.chiaWallet.on("chainChanged", this.handleChainChanged);
    }
    async handleAccountChanged() {
        await this.setUserSession();
    }

    async handleChainChanged() {
        await this.setUserSession();
    }
    async setUserSession() {
        try {
            const [network, publicKeys, accounts] = await Promise.all([
                this.chiaWallet.request({ method: "chainId" }),
                this.chiaWallet.request({ method: "getPublicKeys" }),
                this.chiaWallet.request({ method: "accounts" }),
            ]);

            const prefix = network === "mainnet" ? "xch" : "txch";
            const address = greenweb.util.address.puzzleHashToAddress(accounts[0], prefix);

            this.userInfo = {
                pubkey: publicKeys[0],
                address,
                puzzleHashAddress: accounts[0],
                network,
                prefix,
            };

        } catch (error) {
            console.error("Error setting user session:", error);
            throw error;
        }
    }

    async getAssetCoins(type = null, assetId = null, includedLocked = false) {
        return await this.chiaWallet.request({
            method: 'getAssetCoins',
            params: { type, assetId, includedLocked }
        });
    }

    async signCoinSpends(coinSpends) {
        return await this.chiaWallet.request({
            method: 'signCoinSpends',
            params: { coinSpends }
        });
    }
    async signMessage(message, publicKey) {
        return await this.chiaWallet.request({
            method: 'signMessage',
            params: { message, publicKey }
        });
    }
    async sendTransaction(spendBundle) {
        return await this.chiaWallet.request({
            method: 'sendTransaction',
            params: { spendBundle }
        });
    }

    async createStandarCoinSpends(selectedCoins, toPuzzleHash, amount, totalChange, fee) {
        console.log("Fee:", fee.toString());
        const coinSpends = [];
        const totalAmount = BigInt(amount);
        const totalFee = BigInt(fee);
        let remainingAmount = totalAmount;
        let remainingChange = BigInt(totalChange);
    
        for (let i = 0; i < selectedCoins.length; i++) {
            const item = selectedCoins[i];
            const coin = item.coin;
            const coinAmount = BigInt(coin.amount);
            const isLastCoin = i === selectedCoins.length - 1;
            const conditions = [];
    
            let amountToSend = 0n;
            let changeForThisCoin = 0n;
    
            if (isLastCoin) {
                amountToSend = remainingAmount;
                if (coinAmount > remainingAmount + totalFee) {
                    changeForThisCoin = coinAmount - remainingAmount - totalFee;
                }
                conditions.push(greenweb.spend.reserveFeeCondition(Number(totalFee)));
                conditions.push(greenweb.spend.createCoinCondition(toPuzzleHash,totalAmount));

            } else {
                amountToSend = coinAmount <= remainingAmount ? coinAmount : remainingAmount;
            }
    
            if (amountToSend > 0n) {
                remainingAmount -= amountToSend;
            }
    
            if (changeForThisCoin > 0n) {
                conditions.push(greenweb.spend.createCoinCondition(coin.puzzle_hash, Number(changeForThisCoin)));
                remainingChange -= changeForThisCoin;
            }
    
            const standardCoin = new greenweb.StandardCoin({
                parentCoinInfo: coin.parent_coin_info,
                puzzleHash: coin.puzzle_hash,
                amount: Number(coin.amount),
                publicKey: this.userInfo.pubkey.slice(2)
            });
    
            const coinWithSolution = standardCoin.addConditionsToSolution(conditions);
    
            const coinSpend = coinWithSolution.spend();
    
            const solutionHex = greenweb.util.sexp.toHex(coinSpend.solution);
    
            coinSpends.push({
                coin: {
                    parent_coin_info: coin.parent_coin_info,
                    puzzle_hash: coin.puzzle_hash,
                    amount: Number(coin.amount)
                },
                puzzle_reveal: item.puzzle,
                solution: solutionHex
            });
    
            console.log("Generated coinSpend:", JSON.stringify(coinSpends[coinSpends.length - 1], null, 2));
    
            if (remainingAmount <= 0n) break;
        }
    
        if (remainingAmount > 0n) {
            Utils.displayToast(`No se pudo cubrir el monto total. Falta: ${remainingAmount.toString()}`);
            return;
        }
    
        return coinSpends;
    }
    
    async standardTransfer(toAddress, amount, fee = 50000000) {
        if (!this.userInfo) {
            Utils.displayToast("User session not initialized. Call initialize() first.");
            return;
        }
    
        try {
            const totalRequired = BigInt(amount) + BigInt(fee);
            console.log("Total required:", totalRequired.toString());
    
            const { selectedCoins, totalSelected, change } = await this.selectCoins(totalRequired);
            console.log("Selected coins:", selectedCoins);
            console.log("Total selected:", totalSelected.toString());
            console.log("Change:", change.toString());
    
            if (selectedCoins.length === 0) {
                Utils.displayToast("No coins selected. Insufficient funds.");
                return;
            }
    
            const toPuzzleHash = greenweb.util.address.addressToPuzzleHash(toAddress, this.userInfo.prefix);
            const changePuzzleHash = this.userInfo.puzzleHashAddress;
            console.log("To Puzzle Hash:", toPuzzleHash);
            console.log("Change Puzzle Hash:", changePuzzleHash);
    
            const coinSpends = await this.createStandarCoinSpends(selectedCoins, toPuzzleHash, amount, changePuzzleHash, change, fee);
            console.log("Generated Coin Spends:", coinSpends);
    
            if (coinSpends.length === 0) {
                Utils.displayToast("No coin spends generated.");
                return;
            }
    
            let signature = await this.signCoinSpends(coinSpends);
            console.log("Signature:", signature);
    
            if (!signature ) {
                Utils.displayToast("Invalid signature.");
                return;
            }
            let spendBundle = {
                coin_spends: coinSpends,
                aggregated_signature: [signature]
            };
    
            console.log("Final Spend Bundle:", spendBundle);
            return await this.sendTransaction(spendBundle);
        } catch (error) {
            console.error("Error en la transferencia estándar:", error);
            if (error.message.includes("some coins not on chain")) {
                console.error("Algunas monedas no están disponibles en la cadena. Intente nuevamente en unos momentos.");
            }
            throw error;
        }
    }

    async selectCoins(totalRequired) {
        let selectedCoins = [];
        let totalSelected = BigInt(0);
        
        console.log("Total requerido:", totalRequired.toString());
        
        // Obtener las monedas actualizadas
        const availableCoins = await this.getAssetCoins();
        
        // Filtrar monedas confirmadas y válidas
        const validCoins = availableCoins.filter(item => 
            item && 
            item.coin && 
            typeof item.coin.amount === 'number' && 
            !isNaN(item.coin.amount) 
        );
        
        console.log("Monedas válidas:", validCoins);
    
        for (let item of validCoins) {
            const coinAmount = BigInt(item.coin.amount);
            console.log("Monto de la moneda:", coinAmount.toString());
            
            selectedCoins.push(item);
            totalSelected += coinAmount;
            
            console.log("Total seleccionado hasta ahora:", totalSelected.toString());
    
            if (totalSelected >= totalRequired) break;
        }
    
        console.log("Total seleccionado final:", totalSelected.toString());
    
        if (totalSelected < totalRequired) {
            Utils.displayToast(`Insufficient funds for the transfer and fee. Required: ${totalRequired.toString()}, Available: ${totalSelected.toString()}`);
            return { selectedCoins: [], totalSelected: 0n, change: 0n };
        }
    
        const change = totalSelected - BigInt(totalRequired);
        console.log("Cambio:", change.toString());
        return { 
            selectedCoins, 
            totalSelected, 
            change 
        };
    }

    
}
