class Utils {
    static async convertAddressToPuzzleHash(address) {
        try {
            const response = await Utils.fetch("/convertAddressToPuzzleHash", { address: address });
            if (response.success) {
                return response.puzzle_hash;
            }
            return null;
        } catch (error) {
            return null;
            Utils.displayToast("Error converting address to puzzle hash");
        }
    }
    static formatMojosPrefix(mojos, mainnet = null) {
        if(mainnet == null)
            return "config net not set"
        return `${this.formatMojos(mojos)} ${mainnet ? "XCH" : "TXCH"}`;
    }
    static formatMojos(mojos) {
        const conversionFactor = 1000000000000;
        const XCH = parseInt(mojos) / conversionFactor;
        return `${XCH.toLocaleString(undefined, { maximumFractionDigits: 13 })}`;
    }
    static XCHToMojos(XCH) {
        const conversionFactor = 1000000000000;
        return (XCH) * conversionFactor;
    }
    static copyToClipboard(elementSelector) {
        const element = document.querySelector(elementSelector);
        const text = element.innerText;
        const os = navigator.platform.toLowerCase();

        // Aplicar reemplazo solo si es Windows
        const processedText = os.includes('win') ? text.replace(/"/g, '\\"') : text;
        navigator.clipboard
            .writeText(processedText)
            .then(() => {
                this.displayToast("Copied to clipboard")
            })
            .catch((err) => {
                this.displayToast("Error copying to clipboard:", err)
            });
    }
    static displayToast(message, type = "success") {
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top", 
            position: "center",
            stopOnFocus: true, 
          }).showToast();
    }
    static async getCoinPendingTransaction(coinId) {
        try {
            const response = await this.fetch("/getCoinPendingTransaction", {coinId});
            return response;
        } catch (error) {
            return { success: false, message: "Error fetching data" , error: error};
        }
    }
    static async fetch(endPoint, body,displaySpinner = false,signal = null) {
        try {
            if (displaySpinner) {
                this.showSpinner();
            }
            const response = await fetch(endPoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                signal: signal,
                body: JSON.stringify(body),
            });
            if (displaySpinner) {
                this.hideSpinner();
            }
            return await response.json();
        } catch (error) {
            if (displaySpinner) {
                this.hideSpinner();
            }
            return { success: false, message: "Error fetching data" , error: error};
        }
    }
    static async downloadJson(name,spendBundle)  {
        const json = JSON.stringify(spendBundle, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name + '.json';
        link.click();
        URL.revokeObjectURL(url);
    }
    static async getUserOpenGames(pubkey,showLoading = false) {
        try {
            const response = await Utils.fetch("/getUserOpenGames", { pubkey: pubkey },showLoading);
            return response;
        } catch (error) {
            return { success: false, message: "Error getting open games" };
        }
    }
    static async getUserProfile(pubkey,showLoading = false) {
        try {
            const response = await Utils.fetch("/getUserProfile", { pubkey: pubkey },showLoading);
            return response;
        } catch (error) {
            return { success: false, message: "Error getting user profile" };
        }
    }
    static async getUserHistoryGames(pubkey,showLoading = false) {
        try {
            const response = await Utils.fetch("/getUserHistoryGames", { pubkey: pubkey },showLoading);
            return response;
        } catch (error) {
            return { success: false, message: "Error getting history games" };
        }
    }
    static async getGlobalStats(showLoading = false) {
        try {
            const response = await Utils.fetch("/getGlobalStats", {},showLoading);
            return response;
        } catch (error) {
            return { success: false, message: "Error getting global stats" };
        }
    }
    static async getHistoryGames(showLoading = false) {
        try {
            const response = await Utils.fetch("/getHistoryGames", {},showLoading);
            return response;
        } catch (error) {
            return { success: false, message: "Error getting history games" };
        }
    }
    static showSpinner(message = "") {
        if (this.spinnerContainer) {
            const messageContainer = document.querySelector(".spinner-message");
            messageContainer.textContent = message;
            return;
        }

        this.spinnerContainer = document.createElement("div");
        this.spinnerContainer.className = "spinner-overlay";
        this.spinnerContainer.innerHTML = `
            <div class="spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="spinner-message">${message}</p>
            </div>
        `;

        const overlayStyles = {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '9999'
        };
        const spinnerStyles = {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
        };
        Object.assign(this.spinnerContainer.style, overlayStyles);
        Object.assign(this.spinnerContainer.querySelector('.spinner').style, spinnerStyles);

        document.body.appendChild(this.spinnerContainer);
    }

    static hideSpinner() {
        if (this.spinnerContainer) {
            document.body.removeChild(this.spinnerContainer);
            this.spinnerContainer = null;
        }
    }
    static getPublicKeyFromUrl() {
        let urlObj = new URL(window.location);
        let pubkey = urlObj.pathname.split('/').pop();
        return pubkey;
    }
    static async getGameDetails(coinId,showSpinner = false, signal = null) {
        try {
            const response = await Utils.fetch("/getGameDetails", { coinId: coinId },showSpinner,signal);
            return response;
        } catch (error) {
            return { success: false, message: "Error getting game info" };
            console.error(error);
        }
    }
    static async getLeaderboard() {
        try {
            const response = await Utils.fetch("/getLeaderboard");
            return response;
        } catch (error) {
            return { success: false, message: "Error getting leaderboard" };
        }
    }
    static async verifySignatureLogin(pubkey,message, signature, signingMode,address = null) {
        try {
            const response = await Utils.fetch("/verifySignatureLogin", { pubkey,message, signature, signingMode,address },true);
            return response;
        } catch (error) {
            return { success: false, message: "Error verifying signature" };
        }
    }
    static async getBlockChainState() {
        try {
            const response = await Utils.fetch("/getBlockChainState");
            return response;
        } catch (error) {
            return { success: false, message: "Error getting blockchain state" };
        }
    }
    static async getUserName(pubkey) {
        try {
            const response = await Utils.fetch("/getUserName", { pubkey });
            return response;
        } catch (error) {
            return { success: false, message: "Error getting username" };
        }
    }

    static utf8ToHex(str) {
        return Array.from(str).map(c => 
            c.charCodeAt(0).toString(16).padStart(2, '0')
        ).join('');
    }
    
}