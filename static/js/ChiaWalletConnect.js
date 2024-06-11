WClient = window["@walletconnect/sign-client"].SignClient;
ProposalTypes = WalletConnectTypes;
class ChiaWalletConnect extends EventTarget {
    constructor({ projectId, relayUrl, chainId }) {
        
        super();
        this.today = new Date().toISOString().slice(0, 10);
        this.ModalChiaWalletConnect = ModalChiaWalletConnect??'';
        this.loginMessage = `Login_RPS_${this.today}`;
        this.ChiaMethod = {
            LogIn: "chia_logIn",
            GetWallets: "chia_getWallets",
            GetTransaction: "chia_getTransaction",
            GetWalletBalance: "chia_getWalletBalance",
            GetCurrentAddress: "chia_getCurrentAddress",
            SendTransaction: "chia_sendTransaction",
            SignMessageById: "chia_signMessageById",
            SignMessageByAddress: "chia_signMessageByAddress",
            VerifySignature: "chia_verifySignature",
            GetNextAddress: "chia_getNextAddress",
            GetSyncStatus: "chia_getSyncStatus",
            GetAllOffers: "chia_getAllOffers",
            GetOffersCount: "chia_getOffersCount",
            CreateOfferForIds: "chia_createOfferForIds",
            CancelOffer: "chia_cancelOffer",
            CheckOfferValidity: "chia_checkOfferValidity",
            TakeOffer: "chia_takeOffer",
            GetOfferSummary: "chia_getOfferSummary",
            GetOfferData: "chia_getOfferData",
            GetOfferRecord: "chia_getOfferRecord",
            GetCatWalletInfo: "chia_getCATWalletInfo",
            GetCatAssetId: "chia_getCATAssetId",
            SpendCat: "chia_spendCAT",
            AddCatToken: "chia_addCATToken",
            GetNfts: "chia_getNFTs",
            GetNftInfo: "chia_getNFTInfo",
            MintNft: "chia_mintNFT",
            TransferNft: "chia_transferNFT",
            GetNftsCount: "chia_getNFTsCount",
            CreateNewDidWallet: "chia_createNewDIDWallet",
            SetDidName: "chia_setDIDName",
            SetNftDid: "chia_setNFTDID",
            GetNftWalletsWithDids: "chia_getNFTWalletsWithDIDs",
            GetWalletAddresses: "chia_getWalletAddresses",
        };
        this.projectId = projectId;
        this.relayUrl = relayUrl;
        this.chainId = chainId;
        this.client = null;
        this.pairings = [];
        this.session = null;
        this.fingerprint = "";
        this.isInitializing = false;
        this.accounts = [];
        this.qrContainerId = "qr-container";

        this.init();
        //TODO: change for url origin
        this.METADATA = WalletConnectTypes.Metadata = {
            name: "Chia Rock Paper & Scissors Game",
            description:
                "Smart contract based Rock Paper & Scissors game on Chia blockchain",
            url: "https://chiarps.mrdennis.dev/",
            icons: [
                "https://chiarps.mrdennis.dev/static/images/logo_150x150.jpg",
            ],
        };
        this.REQUIRED_NAMESPACES = ProposalTypes.RequiredNamespaces = {
            chia: {
                methods: Object.values(this.ChiaMethod),
                chains: [this.chainId],
                events: [],
            },
        };
        
    }

    async init() {
        try {
            this.isInitializing = true;

            this.client = await WClient.init({
                relayUrl: this.relayUrl,
                projectId: this.projectId,
                metadata: this.METADATA,
            });

            await this.subscribeToEvents(this.client);
            await this.checkPersistedState(this.client);
        } finally {
            this.isInitializing = false;
        }
    }

    reset() {
        this.session = undefined;
        this.accounts = [];
        const event = new CustomEvent('sessionDisconnected');
        this.dispatchEvent(event);
    }
    openModal() {
        if (document.getElementById("ModalChiaWalletConnect")) {
            return;
        }
        document.body.insertAdjacentHTML('beforeend', this.ModalChiaWalletConnect);
        var myModal = new mdb.Modal(document.getElementById("ModalChiaWalletConnect"), {
            keyboard: false
        });
        let modalElement = document.getElementById("ModalChiaWalletConnect");
        modalElement.addEventListener('hidden.mdb.modal', function () {
            modalElement.remove();  
        });
        modalElement.addEventListener('shown.mdb.modal',  ()=> {
            SignMessageGUI.innerHTML = this.loginMessage;
            loginString.innerHTML = this.loginMessage;
        });
        if (btnLoginGUI) {
            btnLoginGUI.addEventListener('click', async () => {
            this.logInGUI();
            });
        }
        btnLoginCLI.addEventListener('click', async () => {
            this.logInCLI();
        });
        didInputCLI.addEventListener('input', async () => {
            didCLICMD.innerHTML = didInputCLI.value;
        });
        fingerprintInput.addEventListener('input', async () => {
            fingerPrintCMD.innerHTML = fingerprintInput.value;
        });
        document.querySelectorAll('a[data-mdb-tab-init]').forEach(tab => {
            tab.addEventListener('click', function (event) {
                event.preventDefault();
                const myTab = new mdb.Tab(tab);
                myTab.show();
            });
        });
        
        myModal.show();
    }
    async logInCLI() {
        try{
            if(didInputCLI.value === '' || fingerprintInput.value === '' || resultTextarea.value === ''){
                Utils.displayToast('Please fill all the fields', 'error');
                return;
            }
            const output = resultTextarea.value;
            const parsedOutput = this.parseOutput(output);
            if (!parsedOutput) {
                Utils.displayToast('Invalid output', 'error');
                return;
            }
            const isValidSignatureInfo = await Utils.verifySignatureLogin(parsedOutput.publicKey,this.loginMessage, parsedOutput.signature, parsedOutput.signingMode);
            if (isValidSignatureInfo.success == false || !isValidSignatureInfo.isValid) {
                Utils.displayToast('Invalid signature', 'error');
                return;
            }
            Utils.displayToast('Signature verified', 'success');
            UserSession.setUserSession(didInputCLI.value, parsedOutput.publicKey,fingerprintInput.value);
            var modalInstance = mdb.Modal.getInstance(
                document.getElementById("ModalChiaWalletConnect")
            );
            modalInstance.hide();
        }
        catch(e){
            console.error(e);
        }
    }
    parseOutput(text){
        const result = {};
        const messageMatch = text.match(/Message:\s*(.*)/);
        const publicKeyMatch = text.match(/Public Key:\s*([a-fA-F0-9]+)/);
        const signatureMatch = text.match(/Signature:\s*([a-fA-F0-9]+)/);
        const signingModeMatch = text.match(/Signing Mode:\s*(.*)/);

        if (messageMatch) result.message = messageMatch[1];
        if (publicKeyMatch) result.publicKey = publicKeyMatch[1];
        if (signatureMatch) result.signature = signatureMatch[1];
        if (signingModeMatch) result.signingMode = signingModeMatch[1];
        if (result.message && result.publicKey && result.signature && result.signingMode) 
            return result;
        else
            return null;
    }
    async logInGUI() {
        try{
            if(didInputGUI.value === '' || walletGuiOutput.value === ''){
                Utils.displayToast('Please fill all the fields', 'error');
                return;
            }
            const output = walletGuiOutput.value;
            const { pubkey, signature,signing_mode,message,address } = JSON.parse(output);
            if (!pubkey || !signature || !signing_mode || !message || !address) {
                Utils.displayToast('Invalid output', 'error');
                return;
            }
            const isValidSignatureInfo = await Utils.verifySignatureLogin(pubkey,this.loginMessage, signature, signing_mode,address);
            if (isValidSignatureInfo.success == false || !isValidSignatureInfo.isValid) {
                Utils.displayToast('Invalid signature', 'error');
                return;
            }
            Utils.displayToast('Signature verified', 'success');
            UserSession.setUserSession(didInputGUI.value, pubkey);
            var modalInstance = mdb.Modal.getInstance(
                document.getElementById("ModalChiaWalletConnect")
            );
            modalInstance.hide();
        }
        catch(e){
            console.error(e);
        }
        
    }
    async connect(pairing, qrContainerId = null) {
        this.qrContainerId = qrContainerId || this.qrContainerId;
        if (!this.client) throw new Error("WalletConnect is not initialized");
        this.openModal();
        try {
            const { uri, approval } = await this.client.connect({
                pairingTopic: pairing?.topic,
                requiredNamespaces: this.REQUIRED_NAMESPACES,
            });
            if (uri) {
                await this.generateQR(uri, qrContainerId);
                const session = await approval();
                this.onSessionConnected(session);
                this.pairings = this.client.pairing.getAll({ active: true });
            }
        } catch (e) {
            if (e) {
                console.error(e);
            }
        } finally {
        }
    }
    async generateQR(text, elementId) {
        let element = document.getElementById(elementId);
        if (!element) {
            console.error("Elemento no encontrado");
            return;
        }

        let qr = qrcode(0, "L");
        qr.addData(text);
        qr.make();

        let imgTag = document.createElement("img");
        imgTag.src = qr.createDataURL(6);
        imgTag.alt = "QR Code";
        imgTag.style.width = "100%";

        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        element.appendChild(imgTag);
        this.appendCopyIcon(text, elementId);
    }
    appendCopyIcon(uri, elementId) {
        const container = document.getElementById(elementId);
        if (!container) {
            console.error("Elemento del QR no encontrado");
            return;
        }
        const copyButton = document.createElement("button");
        copyButton.id = "copy-link-button";
        copyButton.type = "button";
        copyButton.style.width = "100%";
        copyButton.className = "btn btn-dark"; 
        copyButton.innerHTML = '<i class="fa fa-clipboard"></i> Copy link';
        copyButton.addEventListener("click", () => this.copyToClipboard(uri));
        container.appendChild(copyButton);
    }
    copyToClipboard(text) {
        navigator.clipboard
            .writeText(text)
            .then(() => {
            })
            .catch((err) => {
                console.error("Error copying to clipboard: ", err);
            });
    }
    async disconnect() {
        if (!this.client) throw new Error("WalletConnect is not initialized");
        if (!this.session) throw new Error("Session is not connected");

        await this.client.disconnect({
            topic: this.session.topic,
            reason: "USER_DISCONNECTED",
        });

        this.reset();
    }
    //TODO: give the option to change the fingerprint from the GUI from this.accouts
    onSessionConnected(session) {
        const allNamespaceAccounts = Object.values(session.namespaces)
            .map((namespace) => namespace.accounts)
            .flat();
    
        this.session = session;
        this.accounts = allNamespaceAccounts;
        this.fingerprint = allNamespaceAccounts[0].split(":")[2];
        const event = new CustomEvent('sessionConnected', { detail: { session } });
        this.dispatchEvent(event);
    }
    

    async subscribeToEvents(client) {
        if (!client) throw new Error("WalletConnect is not initialized");

        client.on("session_update", ({ topic, params }) => {
            const { namespaces } = params;
            const session = client.session.get(topic);
            const updatedSession = { ...session, namespaces };
            this.onSessionConnected(updatedSession);
        });

        client.on("session_delete", () => this.reset());

        // Debug
        client.on("session_event", (...args) => console.log(args));
    }

    async checkPersistedState(client) {
        if (!client) throw new Error("WalletConnect is not initialized.");

        this.pairings = client.pairing.getAll({ active: true });

        if (this.session) return;

        if (client.session.length) {
            const lastKeyIndex = client.session.keys.length - 1;
            const session = client.session.get(
                client.session.keys[lastKeyIndex]
            );

            this.onSessionConnected(session);
        }
    }

    async request(method, params) {
        if (!this.client) throw new Error("WalletConnect is not initialized");
        if (!this.session) throw new Error("Session is not connected");

        const result = await this.client.request({
            topic: this.session.topic,
            chainId: this.chainId,
            request: {
                method: method,
                params: {
                    fingerprint: this.fingerprint,
                    ...params,
                },
            },
        });

        if (result.error) {
            throw new Error(result.error.message);
        }
        console.log(result);
        return result.data;
    }

    async logIn(fingerprint) {
        const params = {
            fingerprint: fingerprint,
        };
        return this.request("chia_logIn", params);
    }

    async signMessageById(message, id) {
        if (!this.client) throw new Error("WalletConnect is not initialized");
        if (!this.session) throw new Error("Session is not connected");
        let is_hex = true;
        let safe_mode = false
        const params = { message, id , is_hex, safe_mode};

        return await this.request("chia_signMessageById", params);
    }
    async getWallets() {
        if (!this.client) throw new Error("WalletConnect is not initialized");
        if (!this.session) throw new Error("Session is not connected");
        let includeData = true;
        const params = { includeData };
        return await this.request("chia_getWallets", params);
    }
}
