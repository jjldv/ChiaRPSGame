const ModalChiaWalletConnect = `
<div class="modal fade" id="ModalChiaWalletConnect" tabindex="-1" aria-labelledby="ModalChiaWalletConnect" aria-hidden="true">
<div class="modal-dialog">
    <div class="modal-content">
        <div class="modal-header">
            <h5 class="modal-title" id="exampleModalLabel">Login options</h5>
            <button type="button" class="btn-close" data-mdb-ripple-init data-mdb-dismiss="modal"
                aria-label="Close"></button>
        </div>
        <div class="modal-body">
            <ul class="nav nav-tabs mb-3" id="LoginTabs" role="tablist">
                <li class="nav-item">
                    <a data-mdb-tab-init class="nav-link" id="cli-tab" aria-controls="cli"
                        aria-selected="true" href="#cli" role="tab" aria-controls="cli"
                        aria-selected="true">CLI</a>
                </li>
                <li class="nav-item">
                    <a data-mdb-tab-init class="nav-link" id="walletgui-tab" aria-controls="walletgui-tab"
                        aria-selected="false" href="#walletgui" role="tab" aria-controls="walletgui"
                        aria-selected="false">Wallet GUI</a>
                </li>
                <li class="nav-item">
                    <a data-mdb-tab-init class="nav-link active" id="walletconnect-tab"
                        aria-controls="walletconnect-tab" aria-selected="false" href="#walletconnect" role="tab"
                         aria-controls="walletconnect"
                        aria-selected="false">WalletConnect</a>
                </li>
            </ul>

            <div class="tab-content" id="myTabContent">
                <div class="tab-pane fade " id="cli" role="tabpanel" aria-labelledby="cli-tab">
                    <form id="loginForm">
                        <div class="form-group">
                            <label class="customLabel" for="didInputCLI">DID</label>
                            <input type="text" placeholder="did:chia:1ad..." class="form-control" id="didInputCLI"
                                placeholder="DID">
                        </div>
                        <div class="form-group">
                            <label class="customLabel" for="fingerprintInput">Fingerprint</label>
                            <input type="number" class="form-control" id="fingerprintInput">
                        </div>
                        <div class="form-group position-relative">
                            <label class="customLabel">Command</label>
                            <pre
                                class="precustom"><code id="commandToExecute" >chia wallet did sign_message -f <span id="fingerPrintCMD"></span> -i <span id="didCLICMD"></span> --hex_message "<span id="loginString"></span>"</code></pre>
                            <button type="button"  class="btn position-absolute copy-btn"
                                onclick="Utils.copyToClipboard('#commandToExecute')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>

                        <div class="form-group">
                            <label class="customLabel" for="resultTextarea">Paste your output</label>
                            <textarea class="form-control" id="resultTextarea" rows="3"></textarea>
                        </div>
                        <br>
                        <div class="text-right">
                            <button type="button" id="btnLoginCLI" class="btn btn-primary" style="width:100%">Login</button>
                        </div>
                    </form>
                </div>
                <div class="tab-pane fade" id="walletgui" role="tabpanel" aria-labelledby="walletgui-tab">
                    <form id="loginFormGUI">
                        <div class="customLabel">
                            <ol>
                                <li>In the Wallet GUI, go to <em>Settings</em> -> <em>Advanced</em>.</li>
                                <li>Select <em>Create Signature</em> -> Choose your DID.</li>
                                <li>Paste the following message and sign it:</li>
                            </ol>
                            <p><strong id="SignMessageGUI"></strong>
                                <button type="button" onclick="Utils.copyToClipboard('#SignMessageGUI')"
                                    class="btn copy-btn" title="Copy to clipboard" data-toggle="tooltip"
                                    data-placement="top"><i class="fas fa-copy"></i></button>
                            </p>
                        </div>
                        <img src="/static/images/SingInWaleltGUI.gif"
                            class="img-fluid mx-auto d-block" alt="Wallet GUI Sign Message"
                            style="width: 100%; cursor: pointer;">
                        <div class="form-group">
                            <label class="customLabel" for="didInputGUI">DID</label>
                            <input type="text" placeholder="did:chia:1ad..." class="form-control" id="didInputGUI"
                                placeholder="DID">
                        </div>
                        <div class="form-group">
                            <label class="customLabel" for="walletGuiOutput">Paste your output here:</label>
                            <textarea class="form-control" id="walletGuiOutput" rows="3"
                                aria-describedby="walletGuiOutputHelp"></textarea>
                            <small id="walletGuiOutputHelp" class="form-text text-muted">Make sure to copy the
                                entire signature output.</small>
                        </div>
                        <div class="text-right">
                            <button type="button" id="btnLoginGUI" style="width:100%" class="btn btn-primary">Login</button>
                        </div>
                    </form>
                </div>
                <div class="tab-pane fade show active" id="walletconnect" role="tabpanel"
                    aria-labelledby="walletconnect-tab">
                    <div class="d-flex justify-content-center">
                        <div id="qr-container" style="position: relative; width: 300px;margin-top: 5px;">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</div>`