
class Goby {
    constructor() {
        if (!window.chia) {
            throw new Error("Goby Wallet no está disponible");
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

    async createStandarCoinSpends(selectedCoins, toPuzzleHash, amount, changePuzzleHash, totalChange, fee) {
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
            } else {
                amountToSend = coinAmount <= remainingAmount ? coinAmount : remainingAmount;
            }
    
            if (amountToSend > 0n) {
                conditions.push(greenweb.spend.createCoinCondition(toPuzzleHash, Number(amountToSend)));
                remainingAmount -= amountToSend;
            }
    
            if (changeForThisCoin > 0n) {
                conditions.push(greenweb.spend.createCoinCondition(changePuzzleHash, Number(changeForThisCoin)));
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
            throw new Error(`No se pudo cubrir el monto total. Falta: ${remainingAmount.toString()}`);
        }
    
        return coinSpends;
    }
    
    async standardTransfer(toAddress, amount, fee = 50000000) {
        if (!this.userInfo) {
            throw new Error("User session not initialized. Call initialize() first.");
        }
    
        try {
            const totalRequired = BigInt(amount) + BigInt(fee);
            console.log("Total required:", totalRequired.toString());
    
            const { selectedCoins, totalSelected, change } = await this.selectCoins(totalRequired);
            console.log("Selected coins:", selectedCoins);
            console.log("Total selected:", totalSelected.toString());
            console.log("Change:", change.toString());
    
            if (selectedCoins.length === 0) {
                throw new Error("No coins selected. Insufficient funds.");
            }
    
            const toPuzzleHash = greenweb.util.address.addressToPuzzleHash(toAddress, this.userInfo.prefix);
            const changePuzzleHash = this.userInfo.puzzleHashAddress;
            console.log("To Puzzle Hash:", toPuzzleHash);
            console.log("Change Puzzle Hash:", changePuzzleHash);
    
            const coinSpends = await this.createStandarCoinSpends(selectedCoins, toPuzzleHash, amount, changePuzzleHash, change, fee);
            console.log("Generated Coin Spends:", coinSpends);
    
            if (coinSpends.length === 0) {
                throw new Error("No coin spends generated.");
            }
    
            let signature = await this.signCoinSpends(coinSpends);
            console.log("Signature:", signature);
    
            if (!signature ) {
                throw new Error("Invalid signature.");
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
            throw new Error(`Fondos insuficientes para la transferencia y el fee. Requerido: ${totalRequired.toString()}, Disponible: ${totalSelected.toString()}`);
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
