class Session {
    constructor() {
        this.today = new Date().toISOString().slice(0, 10);
        this.profilePictureLoged = "/static/images/ProfilePictureLoged.jpg";
        this.profilePictureNotLoged =
            "/static/images/ProfilePictureNotLoged.jpg";
        this.DID = localStorage.getItem("DID");
        this.pubkey = localStorage.getItem("pubkey");
        this.fingerprint = localStorage.getItem("fingerprint");
        this.address = localStorage.getItem("address");
        this.walletAddress = localStorage.getItem("walletAddress");
        this.walletPuzzleHash = localStorage.getItem("walletPuzzleHash");
        this.genesisChallenge = localStorage.getItem("genesisChallenge");
        this.walletPuzzleReveal = localStorage.getItem("walletPuzzleReveal");
        this.walletPuzzleRevealDisassembled = localStorage.getItem("walletPuzzleRevealDisassembled");
        this.gamePuzzleHash = localStorage.getItem("gamePuzzleHash");
        this.cashOutAddress = localStorage.getItem("cashOutAddress");
        this.gamePuzzleReveal = localStorage.getItem("gamePuzzleReveal");
        this.gamePuzzleRevealDisassembled = localStorage.getItem("gamePuzzleRevealDisassembled");
        this.oraclePuzzleHash = localStorage.getItem("oraclePuzzleHash");
        if (this.DID) {
            this.setUserSessionUI(true);
        }
        else {
            this.setUserSessionUI(false);
        }
        this.loginMessage = `Login_RPS_${this.today}`;
        this.QrContainerId = "qr-container";
        this.walletConnect = new ChiaWalletConnect({
            relayUrl: "wss://relay.walletconnect.com",
            chainId: "chia:testnet",
            projectId: "b9b6a9774dc1ad59b8f18baf7dfc37e6",
        });
        this.walletConnect.addEventListener(
            "sessionConnected",
            this.walletConnectSessionConnected.bind(this)
        );
        this.walletConnect.addEventListener(
            "sessionDisconnected",
            this.walletConnectSessionDisconnected.bind(this)
        );
    }
    walletConnectSessionDisconnected() {
        this.connectWithWalletConnect();
    }
    walletConnectSessionConnected(e) {
        const { session } = e.detail;
        const qrContainer = document.getElementById(this.QrContainerId);
        if (!qrContainer) return;
        qrContainer.innerHTML = "";

        const onlineMessage = document.createElement("p");
        onlineMessage.textContent = "WalletConnect Online";
        onlineMessage.className = "customLabel";
        onlineMessage.style.textAlign = "center";
        qrContainer.appendChild(onlineMessage);

        const walletConnectLogo = document.createElement("img");
        walletConnectLogo.src = "/static/images/WalletConnectLogo.png";
        walletConnectLogo.style.display = "block";
        walletConnectLogo.style.marginLeft = "auto";
        walletConnectLogo.style.marginRight = "auto";
        walletConnectLogo.style.marginBottom = "10px";
        qrContainer.appendChild(walletConnectLogo);

        const disconnectButton = document.createElement("button");
        disconnectButton.textContent = "Disconnect";
        disconnectButton.className = "btn btn-warning";
        disconnectButton.style.width = "100%";
        disconnectButton.style.marginBottom = "10px";
        disconnectButton.addEventListener(
            "click",
            this.disconnectWalletConnect.bind(this)
        );
        qrContainer.insertBefore(disconnectButton, qrContainer.firstChild);

        const formGroup = document.createElement("div");
        formGroup.className = "form-group";
        formGroup.id = "DIDWalletConnectFormGroup";

        qrContainer.appendChild(formGroup);
        this.setContentWalletConnectLogin(true);
    }
    async disconnectWalletConnect() {
        await this.walletConnect.disconnect();
    }
    setContentWalletConnectLogin(isLoginButton, message = "") {
        let formGroup = document.getElementById("DIDWalletConnectFormGroup");
        if (!formGroup) return;
        formGroup.innerHTML = "";
        if (isLoginButton) {
            const label = document.createElement("label");
            label.className = "customLabel";
            label.textContent = "DID";

            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "did:chia:1ad...";
            input.style.marginBottom = "10px";
            input.className = "form-control";
            input.id = "DIDWalletConnect";

            formGroup.appendChild(label);
            formGroup.appendChild(input);

            const logInButton = document.createElement("button");
            logInButton.textContent = "Log In";
            logInButton.className = "btn btn-primary";
            logInButton.style.width = "100%";
            logInButton.addEventListener("click", () => {
                UserSession.loginWithWalletConnect(input.value);
            });
            formGroup.appendChild(logInButton);
        }
        if (message) {
            const messageElement = document.createElement("p");
            messageElement.textContent = message;
            messageElement.style.textAlign = "center";
            messageElement.style.marginTop = "10px";
            messageElement.className = "alert alert-success";
            formGroup.appendChild(messageElement);
        }
    }
    setUserSession(DID, pubkey, fingerprint = null, address = null) {
        this.DID = DID;
        this.pubkey = pubkey;
        this.address = address;
        this.fingerprint = fingerprint;
        localStorage.setItem("DID", DID);
        localStorage.setItem("pubkey", pubkey);
        localStorage.setItem("fingerprint", fingerprint);
        localStorage.setItem("address", address);
        this.getWalletInfo();

        this.setUserSessionUI();
    }
    setUserSessionUI(isLoged = true) {
        let profilePicture = document.getElementById("ProfilePicture");
        let userUI = document.getElementById("UserUI");

        if (isLoged) {
            profilePicture.src = this.profilePictureLoged;
            userUI.innerHTML = `
                <li><a class="dropdown-item" href="/myGameWallet">My Game Wallet</a></li>
                <li><a class="dropdown-item" href="/createGame">Create Game</a></li>
                <li><a class="dropdown-item" href="/userOpenGames/${this.pubkey}">My Open Games</a></li>
                <li><a class="dropdown-item" href="/userHistoryGames/${this.pubkey}">My History Games</a></li>
                <li><a class="dropdown-item" id="signOut">Sign Out</a></li>
            `;
            document.getElementById("signOut").addEventListener("click", () => {
                this.logout();
            });
        } else {
            profilePicture.src = this.profilePictureNotLoged;
            userUI.innerHTML = `
                <li><a class="dropdown-item" id="BtnLogin" >Login</a></li>
            `;
            document.getElementById("BtnLogin").addEventListener("click", () => {
                this.connectWithWalletConnect();
            });
        }
    }
    async logout() {
        localStorage.removeItem("DID");
        localStorage.removeItem("pubkey");
        localStorage.removeItem("fingerprint");
        localStorage.removeItem("address");
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("walletPuzzleHash");
        localStorage.removeItem("genesisChallenge");
        localStorage.removeItem("walletPuzzleReveal");
        localStorage.removeItem("walletPuzzleRevealDisassembled");
        localStorage.removeItem("cashOutAddress");
        localStorage.removeItem("gamePuzzleHash");
        localStorage.removeItem("gamePuzzleReveal");
        localStorage.removeItem("gamePuzzleRevealDisassembled");
        localStorage.removeItem("oraclePuzzleHash");
        this.DID = null;
        this.pubkey = null;
        this.fingerprint = null;
        this.address = null;
        this.walletAddress = null;
        this.walletPuzzleHash = null;
        this.genesisChallenge = null;
        this.walletPuzzleReveal = null;
        this.walletPuzzleRevealDisassembled = null;
        this.cashOutAddress = null;
        this.gamePuzzleHash = null;
        this.gamePuzzleReveal = null;
        this.gamePuzzleRevealDisassembled = null;
        this.oraclePuzzleHash = null;
        if (this.isWalletConnectConnected()) {
            await this.disconnectWalletConnect();
        }
        location.href = "/";
    }
    async loginWithWalletConnect(DID) {
        try {
            this.setContentWalletConnectLogin(
                false,
                "Waiting for response... Check your wallet."
            );
            let Response = await this.walletConnect.chia_signMessageById(
                this.loginMessage,
                DID
            );
            
            if (Response.success == true) {
                const isValidSignatureInfo = await Utils.verifySignatureLogin(Response.pubkey,this.loginMessage, Response.signature, Response.signingMode,null);
                if (isValidSignatureInfo.success == false || !isValidSignatureInfo.isValid) {
                    Utils.displayToast('Invalid signature', 'error');
                    return;
                }
                Utils.displayToast('Signature verified', 'success');
                var modalInstance = mdb.Modal.getInstance(
                    document.getElementById("ModalChiaWalletConnect")
                );
                modalInstance.hide();
                this.setUserSession(
                    DID,
                    Response.pubkey,
                    this.walletConnect.fingerprint
                );
                return;
            }
            this.setContentWalletConnectLogin(
                true,
                `Error logging in. Try again`
            );
            console.log(Response);
        } catch (e) {
            this.setContentWalletConnectLogin(
                true,
                "Error logging in. Try again"
            );
            console.error(e);
        }
    }
    connectWithWalletConnect() {
        this.walletConnect.connect(null, this.QrContainerId);
    }
    isWalletConnectConnected() {
        return (
            this.walletConnect.session !== undefined &&
            this.walletConnect.session !== null
        );
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
                this.walletAddress = JsonResponse.wallet_address;
                this.walletPuzzleHash = JsonResponse.wallet_puzzle_hash;
                this.genesisChallenge = JsonResponse.genesis_challenge;
                this.walletPuzzleReveal = JsonResponse.wallet_puzzle_reveal;
                this.walletPuzzleRevealDisassembled = JsonResponse.wallet_puzzle_reveal_disassembled;
                this.gamePuzzleHash = JsonResponse.game_puzzle_hash;
                this.gamePuzzleReveal = JsonResponse.game_puzzle_reveal;
                this.gamePuzzleRevealDisassembled = JsonResponse.game_puzzle_reveal_disassembled;
                this.oraclePuzzleHash = JsonResponse.oracle_puzzle_hash;
                localStorage.setItem("walletAddress", this.walletAddress);
                localStorage.setItem("walletPuzzleHash", this.walletPuzzleHash);
                localStorage.setItem("genesisChallenge", this.genesisChallenge);
                localStorage.setItem("walletPuzzleReveal", this.walletPuzzleReveal);
                localStorage.setItem("walletPuzzleRevealDisassembled", this.walletPuzzleRevealDisassembled);
                localStorage.setItem("gamePuzzleHash", this.gamePuzzleHash);
                localStorage.setItem("gamePuzzleReveal", this.gamePuzzleReveal);
                localStorage.setItem("gamePuzzleRevealDisassembled", this.gamePuzzleRevealDisassembled);
                localStorage.setItem("oraclePuzzleHash", this.oraclePuzzleHash);
            }
        } catch (error) {
            console.error(error);
        }
    }
    async getWalletBalance() {
        try {
            const response = await fetch("/getWalletBalance", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    walletPuzzleHash: this.walletPuzzleHash,
                }),
            });
            const JsonResponse = await response.json();
            return JsonResponse;
        } catch (error) {
            console.error(error);
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
            localStorage.setItem("cashOutAddress", this.cashOutAddress);
        } catch (error) {
            console.error(error);
        }
    }
    async getFeeEstimateCloseGame(coinId) {
        try {
            const response = await Utils.fetch("/getFeeEstimateCloseGame", {coinId});
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
                pubkey: this.pubkey
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
                    pubkey: this.pubkey
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
    async getFeeEstimateJoinPlayer2(coinId,coindIdWallet) {
        try {
            const response = await Utils.fetch("/getFeeEstimateJoinPlayer2", {
                coinId: coinId,
                pubkey: this.pubkey,
                coinIdWallet: coindIdWallet
            })
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
            const response = await Utils.fetch("/getFeeEstimateRevealSelectionPlayer1", {
                coinId: coinId,
                pubkey: this.pubkey,
                coinIdWallet: coinIdWallet,
                selection: selection,
                key: key
            })
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
            const response = await Utils.fetch("/closeGame", {
                coinId: coinId,
                pubkey: this.pubkey,
                fee: parseInt(fee),
                signature: signature,
            },true);
            return response;
        } catch (error) {
            return { success: false, message: "Error closing game" };
            console.error(error);
        }
    }
    async joinPlayer1(coinId, fee, betAmount,compromisePlayer1,puzzleHashPlayer1, signature) {
        try {
            const response = await Utils.fetch("/joinPlayer1", {
                coinId: coinId,
                pubkey: this.pubkey,
                fee: fee,
                compromisePlayer1: compromisePlayer1,
                puzzleHashPlayer1: puzzleHashPlayer1,
                signature: signature,
                betAmount: parseInt(betAmount),
            },true);
           return response;
        } catch (error) {
            return { success: false, message: "Error opening game" };
        }
    }
    async joinPlayer2(coinId,coinIdWallet, fee,selection,puzzleHashPlayer2, signature) {
        try {
            const response = await Utils.fetch("/joinPlayer2", {
                coinId: coinId,
                coinIdWallet: coinIdWallet,
                pubkey: this.pubkey,
                fee: fee,
                selection: parseInt(selection),
                puzzleHashPlayer2: puzzleHashPlayer2,
                signature: signature,
            },true);
            return response;
        } catch (error) {
            return { success: false, message: "Error opening game" };
        }
    }
    async cashOut(coinId, walletAddress,signature,fee) {
        try {
            const response = await Utils.fetch("/cashOutCoin", {
                coinId: coinId,
                cashOutAddress: walletAddress,
                pubkey: this.pubkey,
                signature: signature,
                fee: fee,
            },true);
            return response;
        } catch (error) {
            return { success: false, message: "Error cashing out" };
            Utils.displayToast("Error cashing out");
        }
    }
    displayWalletAddressMessage() {
        const formGroup = document.createElement("div");
        formGroup.className = "modal";
        formGroup.id = "walletAddressModal";
        formGroup.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Send any amount to</h5>
                        <button type="button" class="btn-close" data-mdb-ripple-init data-mdb-dismiss="modal"
        aria-label="Close"></button>
                    </div>
                    <div class="modal-body" style="color:white;">
                        <p id="WalletAddressModal">${this.walletAddress}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="Utils.copyToClipboard('#WalletAddressModal');">Copy Address</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(formGroup);
        const walletAddressModal = new mdb.Modal(
            document.getElementById("walletAddressModal")
        );
        walletAddressModal.show();
        const modalElement = document.getElementById("walletAddressModal");
        modalElement.addEventListener("hidden.bs.modal", function () {
            document.body.removeChild(modalElement);
        });
    }
    async revealSelectionPlayer1(coinId,selection,revealKey,signature,coinIdWallet="",fee="",signatureWallet="") {
        try {
            const response = await Utils.fetch("/revealSelectionPlayer1", {
                coinId: coinId,
                pubkey: this.pubkey,
                selection: parseInt(selection),
                revealKey: revealKey,
                signature: signature,
                coinIdWallet: coinIdWallet,
                fee: fee,
                signatureWallet: signatureWallet
            },true);
            return response;
        } catch (error) {
            return { success: false, message: "Error revealing selection" };
        }
    }
    async getFeeEstimateClaimGame(coinId) {
        try {
            const response = await Utils.fetch("/getFeeEstimateClaimGame", {coinId});
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
            const response = await Utils.fetch("/claimGame", {
                coinId: coinId,
                fee: parseInt(fee),
                signature: signature,
            },true);
            return response;
        } catch (error) {
            return { success: false, message: "Error claiming game" };
            console.error(error);
        }
    }
    async revealSelectionPlayer1WithFee(coinId,selection,revealKey,signature,coinIdWallet,fee,signatureWallet) {
        try {
            const response = await Utils.fetch("/revealSelectionPlayer1WithFee", {
                coinId: coinId,
                pubkey: this.pubkey,
                selection: parseInt(selection),
                revealKey: revealKey,
                signature: signature,
                coinIdWallet: coinIdWallet,
                fee: fee,
                signatureWallet: signatureWallet
            },true);
            return response;
        } catch (error) {
            return { success: false, message: "Error revealing selection" };
        }
    }
}
