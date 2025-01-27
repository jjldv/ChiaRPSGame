class Session {
    constructor() {
        this.chiaWallet = window.chia;
        this.ModalGobyWallet = ModalGobyWallet ?? "";
        this.Goby;
        this.pubkey = null;
        this.walletAddress = null;
        this.walletPuzzleHash = null;
        this.network = null;
        this.prefix = null;
        this.today = new Date().toISOString().slice(0, 10);
        this.profilePictureLoged = "/static/images/ProfilePictureLoged.jpg";
        this.profilePictureNotLoged ="/static/images/ProfilePictureNotLoged.jpg";
        this.setUserSessionUI(false);
        this.initAsync();
        this.eventListeners = {};
        this.startPeriodicUpdate(document.getElementById("nodeStatus"));
    }
    async initAsync() {
        try {
            const isConnected = await this.IsGobyConnected();
            if (!isConnected) {
                return;
            }
            this.Goby = new Goby();
            this.Goby.initialize();
            this.chiaWallet.on("accountChanged", () => {
                window.location.reload();
            });
            this.emit('connected');
        } catch (error) {
            console.error("Error initializing Goby connection:", error);
        }
    }
    on(eventName, callback) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    // Nuevo: Método para emitir eventos
    emit(eventName, ...args) {
        const listeners = this.eventListeners[eventName];
        if (listeners) {
            listeners.forEach(listener => listener(...args));
        }
    }
    async IsGobyConnected() {
        try {
            if (Boolean(this.chiaWallet && this.chiaWallet.isGoby) == false)
                return false;
            await this.chiaWallet.request({
                method: "connect",
                params: { eager: true },
            });

            await this.setUserSession();
            return true;
        } catch (e) {
            return false;
        }
    }

    async setUserSession() {
        try {
            const [network, publicKeys, accounts] = await Promise.all([
                this.chiaWallet.request({ method: "chainId" }),
                this.chiaWallet.request({ method: "getPublicKeys" }),
                this.chiaWallet.request({ method: "accounts" }),
            ]);

            const prefix = network === "mainnet" ? "xch" : "txch";
            const walletAddress = greenweb.util.address.puzzleHashToAddress(
                accounts[0],
                prefix
            );

            Object.assign(this, {
                pubkey: publicKeys[0],
                walletAddress,
                walletPuzzleHash: accounts[0],
                network,
                prefix,
            });

            this.setUserSessionUI();

            const reloadPage = () => window.location.reload();
            this.chiaWallet.on("accountChanged", reloadPage);
            this.chiaWallet.on("chainChanged", reloadPage);
        } catch (error) {
            console.error("Error setting user session:", error);
        }
    }
    async setUserSessionUI(isLoged = true) {
        let profilePicture = document.getElementById("ProfilePicture");
        let userUI = document.getElementById("UserUI");

        if (isLoged) {
            profilePicture.src = this.profilePictureLoged;
            userUI.innerHTML = `
                <li class="dropdown-item" id="NameLabel" ></li>
                <li><a class="dropdown-item" href="/createGame">Create Game</a></li>
                <li><a class="dropdown-item" id="btnSetMyName" >Set my name</a></li>
                <li><a class="dropdown-item" href="/userOpenGames/${this.pubkey}">My Open Games</a></li>
                <li><a class="dropdown-item" href="/userHistoryGames/${this.pubkey}">My History Games</a></li>
                <li><a class="dropdown-item" id="btnEnableNotifications">Enable Notifications</a></li>
            `;
            document
                .getElementById("btnSetMyName")
                .addEventListener("click", () => {
                    this.setMyName();
                });
            document.getElementById("btnEnableNotifications").addEventListener("click", () => {
                this.enableNotifications();
            });
            const status = await this.checkNotificationStatus();
            
            
            let UserName = await Utils.getUserName(this.pubkey);
            if (UserName.success) {
                document.getElementById("NameLabel").innerHTML = UserName.name;
            }
        } else {
            profilePicture.src = this.profilePictureNotLoged;
            userUI.innerHTML = `
                <li><a class="dropdown-item" id="BtnLogin" >Login</a></li>
            `;
            document
                .getElementById("BtnLogin")
                .addEventListener("click", () => {
                    this.loginWithGobyWallet();
                });
        }
    }
    
    async loginWithGobyWallet() {
        if (Boolean(this.chiaWallet && this.chiaWallet.isGoby) == false) {
            this.openModalGobyWallet();
            return;
        }
        try {
            let connect = await window.chia.request({ method: "connect" });
            await this.chiaWallet.request({
                method: "connect",
                params: { eager: true },
            });
            const network = await this.chiaWallet.request({
                method: "chainId",
            });
            const publicKeys = await this.chiaWallet.request({
                method: "getPublicKeys",
            });
            const accounts = await this.chiaWallet.request({
                method: "accounts",
            });
            const prefix = network == "mainnet" ? "xch" : "txch";
            const address = greenweb.util.address.puzzleHashToAddress(
                accounts[0],
                prefix
            );
            await this.setUserSession();
        } catch (err) {
            console.error(err);
        }
    }
    openModalGobyWallet() {
        if (document.getElementById("ModalGobyWallet")) {
            return;
        }
        document.body.insertAdjacentHTML("beforeend", this.ModalGobyWallet);
        var myModal = new mdb.Modal(
            document.getElementById("ModalGobyWallet"),
            {
                keyboard: false,
            }
        );
        let modalElement = document.getElementById("ModalGobyWallet");
        modalElement.addEventListener("hidden.mdb.modal", function () {
            modalElement.remove();
        });
        myModal.show();
    }
    async getWalletInfo() {
        try {
            const response = await fetch("/getWalletGameInfo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pubkey: this.pubkey }),
            });
            const JsonResponse = await response.json();
            if (JsonResponse.success) {
                this.genesisChallenge = JsonResponse.genesis_challenge;
                this.walletPuzzleReveal = JsonResponse.wallet_puzzle_reveal;
                this.walletPuzzleRevealDisassembled = JsonResponse.wallet_puzzle_reveal_disassembled;
                this.gamePuzzleHash = JsonResponse.game_puzzle_hash;
                this.gamePuzzleReveal = JsonResponse.game_puzzle_reveal;
                this.gamePuzzleRevealDisassembled = JsonResponse.game_puzzle_reveal_disassembled;
                this.oraclePuzzleHash = JsonResponse.oracle_puzzle_hash;
            }
            return JsonResponse;
        } catch (error) {
            console.error(error);
            return { success: false, message: "Error getting wallet info" };
        }
    }
    async createSolutionCloseGame(coinAmount,fee) {
        try {
            const response = await fetch("/createSolutionCloseGame", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pubkey: this.pubkey, coinAmount: coinAmount, fee: fee }),
            });
            const JsonResponse = await response.json();
            return JsonResponse;
        } catch (error) {
            console.error(error);
            return { success: false, message: "Error creating solution" };
        }
    }
    async createSolutionRevealGame(selection,revealKey,coinAmount) {
        try {
            const response = await fetch("/createSolutionRevealGame", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pubkey: this.pubkey, selection: selection, revealKey: revealKey, coinAmount: coinAmount }),
            });
            const JsonResponse = await response.json();
            return JsonResponse;
        } catch (error) {
            console.error(error);
            return { success: false, message: "Error creating solution" };
        }
    }
    async createSolutionClaimGame(coinAmount,fee) {
        try {
            const response = await fetch("/createSolutionClaimGame", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pubkey: this.pubkey, coinAmount: coinAmount, fee: fee }),
            });
            const JsonResponse = await response.json();
            return JsonResponse;
        } catch (error) {
            console.error(error);
            return { success: false, message: "Error creating solution" };
        }
    }
    async createSolutionJoinPlayer1(puzzle_hash,amount,selectionHash,cashOutAddressHash){
        try {
            const response = await fetch("/createSolutionJoinPlayer1", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pubkey: this.pubkey, puzzle_hash: puzzle_hash, amount: amount, selectionHash: selectionHash, cashOutAddressHash: cashOutAddressHash }),
            });
            const JsonResponse = await response.json();
            return JsonResponse;
        } catch (error) {
            console.error(error);
            return { success: false, message: "Error creating solution" };
        }
    }
    async createSolutionJoinPlayer2(selection, cashOutAddressHash, coinId) {
        try {
            const response = await fetch("/createSolutionJoinPlayer2", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                    pubkey: this.pubkey, 
                    selection: selection, 
                    cashOutAddressHash: cashOutAddressHash, 
                    coinId: coinId, 
                }),
            });
            const JsonResponse = await response.json();
            return JsonResponse;
        } catch (error) {
            console.error(error);
            return { success: false, message: "Error creating solution" };
        }
    }
    async pushTx(tx) {
        try {
            const response = await fetch("/pushTx", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ tx: tx }),
            });
            const JsonResponse = await response.json();
            return JsonResponse;
        } catch (error) {
            console.error(error);
            return { success: false, message: "Error pushing transaction" };
        }
    }
    async getGameWalletBalance(walletPuzzleHash) {
        try {
            const response = await fetch("/getWalletBalance", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ walletPuzzleHash: walletPuzzleHash }),
            });
            const JsonResponse = await response.json();

            return JsonResponse;
        } catch (error) {
            console.error(error);
            return { success: false, message: "Error getting wallet info" };
        }
    }
    async getWalletBalance() {
        try {
            const response = await this.chiaWallet.request({
                method: 'getAssetBalance',
                params: {
                    type: null,  
                    assetId: null  
                }
            });

            return {
                confirmed: response.confirmed,
                spendable: response.spendable,
                spendableCoinCount: response.spendableCoinCount
            };
        } catch (error) {
            console.error('Error getting wallet balance:', error);
            throw error;
        }
    }
    async chargeWallet() {
        try {
            this.displayWalletAddressMessage();
            //TODO: send via wallet connect
        } catch (error) {
            console.error(error);
        }
    }
    async sha256Hex(message) {
        try {
            const response = await fetch("/sha256Hex", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: message }),
            });
            const JsonResponse = await response.json();
            if (JsonResponse.success) {
                return JsonResponse.message_hash;
            }
            return null;
        } catch (error) {
            return null;
            console.error(error);
        }
    }
    async concat(params) {
        try {
            const response = await fetch("/concat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ params: params }),
            });
            const JsonResponse = await response.json();
            if (JsonResponse.success) {
                return JsonResponse.result;
            }
            return null;
        } catch (error) {
            return null;
            console.error(error);
        }
    }
    async setCashOutAddress(address) {
        try {
            this.cashOutAddress = address;
        } catch (error) {
            console.error(error);
        }
    }
    async getFeeEstimateCloseGame(coinId) {
        try {
            const response = await Utils.fetch("/getFeeEstimateCloseGame", {
                coinId,
            });
            if (response.success) {
                return response.infoFee.estimates[0];
            }
            return 0;
        } catch (error) {
            return 0;
            Utils.displayToast("Error getting fee estimate");
        }
    }
    async getFeeEstimateCashOut(coinId) {
        try {
            const response = await Utils.fetch("/getFeeEstimateCashOut", {
                coinId: coinId,
                pubkey: this.pubkey,
            });
            if (response.success) {
                return response.infoFee.estimates[0];
            }
            return 0;
        } catch (error) {
            return 0;
            Utils.displayToast("Error getting fee estimate");
        }
    }
    async getFeeEstimateJoinPlayer1(coinId) {
        try {
            const response = await fetch("/getFeeEstimateJoinPlayer1", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    coinId: coinId,
                    pubkey: this.pubkey,
                }),
            });
            const JsonResponse = await response.json();
            if (!JsonResponse.success && JsonResponse.message) {
                Utils.displayToast(JsonResponse.message);
                return 0;
            }
            if (JsonResponse.success) {
                return JsonResponse.infoFee.estimates[0];
            }
            return 0;
        } catch (error) {
            return 0;
            console.error(error);
        }
    }
    async getFeeEstimateJoinPlayer2(coinId, coindIdWallet) {
        try {
            const response = await Utils.fetch("/getFeeEstimateJoinPlayer2", {
                coinId: coinId,
                pubkey: this.pubkey,
                coinIdWallet: coindIdWallet,
            });
            if (response.success) {
                return response.infoFee.estimates[0];
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }
    async getFeeEstimateRevealSelectionPlayer1(coinId,coinIdWallet,selection,key) {
        try {
            const response = await Utils.fetch(
                "/getFeeEstimateRevealSelectionPlayer1",
                {
                    coinId: coinId,
                    pubkey: this.pubkey,
                    coinIdWallet: coinIdWallet,
                    selection: selection,
                    key: key,
                }
            );
            if (response.success) {
                return response.infoFee.estimates[0];
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }
    async closeGame(coinId, fee, signature) {
        try {
            const response = await Utils.fetch(
                "/closeGame",
                {
                    coinId: coinId,
                    pubkey: this.pubkey,
                    fee: parseInt(fee),
                    signature: signature,
                },
                true
            );
            return response;
        } catch (error) {
            return { success: false, message: "Error closing game" };
            console.error(error);
        }
    }
    async joinPlayer1(coinId,fee,betAmount,compromisePlayer1,puzzleHashPlayer1,signature) {
        try {
            const response = await Utils.fetch(
                "/joinPlayer1",
                {
                    coinId: coinId,
                    pubkey: this.pubkey,
                    fee: fee,
                    compromisePlayer1: compromisePlayer1,
                    puzzleHashPlayer1: puzzleHashPlayer1,
                    signature: signature,
                    betAmount: parseInt(betAmount),
                },
                true
            );
            return response;
        } catch (error) {
            return { success: false, message: "Error opening game" };
        }
    }

    async joinPlayer2(spendBundle,coinId,parentIdWallet,fee,selection,puzzleHashPlayer2,signature) {
        try {
            const response = await Utils.fetch(
                "/joinPlayer2",
                {
                    coinId: coinId,
                    parentIdWallet: parentIdWallet,
                    pubkey: this.pubkey,
                    fee: fee,
                    selection: parseInt(selection),
                    puzzleHashPlayer2: puzzleHashPlayer2,
                    signature: signature,
                    spendBundle: spendBundle,
                },
                true
            );
            return response;
        } catch (error) {
            return { success: false, message: "Error opening game" };
        }
    }
    async cashOut(coinId, walletAddress, signature, fee) {
        try {
            const response = await Utils.fetch(
                "/cashOutCoin",
                {
                    coinId: coinId,
                    cashOutAddress: walletAddress,
                    pubkey: this.pubkey,
                    signature: signature,
                    fee: fee,
                },
                true
            );
            return response;
        } catch (error) {
            return { success: false, message: "Error cashing out" };
            Utils.displayToast("Error cashing out");
        }
    }
    async revealSelectionPlayer1(coinId,selection,revealKey,signature,coinIdWallet = "",fee = "",signatureWallet = "") {
        try {
            const response = await Utils.fetch(
                "/revealSelectionPlayer1",
                {
                    coinId: coinId,
                    pubkey: this.pubkey,
                    selection: parseInt(selection),
                    revealKey: revealKey,
                    signature: signature,
                    coinIdWallet: coinIdWallet,
                    fee: fee,
                    signatureWallet: signatureWallet,
                },
                true
            );
            return response;
        } catch (error) {
            return { success: false, message: "Error revealing selection" };
        }
    }
    async getFeeEstimateClaimGame(coinId) {
        try {
            const response = await Utils.fetch("/getFeeEstimateClaimGame", {
                coinId,
            });
            if (response.success) {
                return response.infoFee.estimates[0];
            }
            return 0;
        } catch (error) {
            return 0;
            Utils.displayToast("Error getting fee estimate");
        }
    }
    async claimGame(coinId, fee, signature) {
        try {
            const response = await Utils.fetch(
                "/claimGame",
                {
                    coinId: coinId,
                    fee: parseInt(fee),
                    signature: signature,
                },
                true
            );
            return response;
        } catch (error) {
            return { success: false, message: "Error claiming game" };
            console.error(error);
        }
    }
    async revealSelectionPlayer1WithFee(coinId,selection,revealKey,signature,coinIdWallet,fee,signatureWallet) {
        try {
            const response = await Utils.fetch(
                "/revealSelectionPlayer1WithFee",
                {
                    coinId: coinId,
                    pubkey: this.pubkey,
                    selection: parseInt(selection),
                    revealKey: revealKey,
                    signature: signature,
                    coinIdWallet: coinIdWallet,
                    fee: fee,
                    signatureWallet: signatureWallet,
                },
                true
            );
            return response;
        } catch (error) {
            return { success: false, message: "Error revealing selection" };
        }
    }
    async updateBlockchainSyncStatus(nodeStatusElement) {
        if (!nodeStatusElement) {
            console.error("Node status element not found");
            return;
        }
        try {
            const state = await Utils.getBlockChainState();
            if (!state.success) {
                throw new Error("Failed to get blockchain state");
            }
    
            const { sync } = state.blockchain_state;
            nodeStatusElement.textContent = sync.synced
                ? "Synced"
                : `Syncing ${sync.sync_progress_height}/${sync.sync_tip_height}`;
        } catch (error) {
            console.error("Error updating blockchain status:", error);
            nodeStatusElement.textContent = "Error fetching status";
        }
    }
    startPeriodicUpdate(nodeStatusElement, updateInterval = 60000) {
        this.updateBlockchainSyncStatus(nodeStatusElement);
        return setInterval(() => this.updateBlockchainSyncStatus(nodeStatusElement), updateInterval);
    }
    async setMyName() {
        const name = prompt("Please enter your name:");
        if (!name) {
            alert("Name cannot be empty.");
            return;
        }

        let message = `Set name: ${name}`;
        try {
            message = Utils.utf8ToHex(message);
            const signature = await this.Goby.signMessage(message, this.pubkey);
            console.log("Signature:", signature);
            const response = await this.setMyNameOnServer(message, signature, name);
            if (response) {
                document.getElementById("NameLabel").innerHTML = name;
            }
        } catch (error) {
            console.error("Error setting name:", error);
            Utils.displayToast("Error setting name");
        }
    }
    async setMyNameOnServer(message, signature, name) {
        try {
            const response = await Utils.fetch("/setMyName", {
                pubkey: this.pubkey,
                message: message,
                signature: signature,
                name: name,
            });
            if (response.success) {
                Utils.displayToast("Name set successfully");
                return true;
            } else {
                Utils.displayToast(response.message);
                return false;
            }
        } catch (error) {
            console.error(error);
            Utils.displayToast("Error setting name");
        }
    }
    async checkNotificationStatus() {
        try {
            const firebase = new Firebase();
            await firebase.init();
            
            const status = await firebase.checkPermissionStatus();
            if (status.isEnabled && status.token) {
                // Actualizar el token en el servidor
                const response = await Utils.fetch("/registerFirebaseToken", {
                    pubkey: this.pubkey,
                    token: status.token
                });
    
                if (!response.success) {
                    console.warn("Failed to update token on server:", response.message);
                }
    
                return {
                    isEnabled: true,
                    token: status.token
                };
            }
            
            return {
                isEnabled: false,
                reason: status.reason
            };
        } catch (error) {
            console.error("Error checking notification status:", error);
            return {
                isEnabled: false,
                error: error.message
            };
        }
    }
    
    async enableNotifications() {
        try {
            const status = await this.checkNotificationStatus();
            
            if (status.isEnabled) {
                Utils.displayToast("Notifications are already enabled");
                return;
            }
            
            const firebase = new Firebase();
            await firebase.init();
            
            const token = await firebase.requestPermission();
            if (!token) {
                throw new Error("Failed to get notification token");
            }
            
            const response = await Utils.fetch("/registerFirebaseToken", {
                pubkey: this.pubkey,
                token: token
            });
    
            if (response.success) {
                Utils.displayToast("Notifications enabled successfully");
            } else {
                throw new Error(response.message || "Failed to register token");
            }
            
            console.log("Notification token:", token);
        } catch (error) {
            console.error("Error enabling notifications:", error);
            Utils.displayToast("Error enabling notifications");
        }
    }
}
