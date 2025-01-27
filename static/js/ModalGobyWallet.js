const ModalGobyWallet = `
<div class="modal fade" id="ModalGobyWallet" tabindex="-1" aria-labelledby="ModalGobyWallet" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLabel">Connect with GobbyWallet</h5>
        <button type="button" class="btn-close" data-mdb-ripple-init data-mdb-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body" >
        <div id="gobbyWalletContent" class="text-center">
          <div id="gobyWalletNotInstalled" class="text-center" style="display:block">
            <p class="mb-4" style="color:white">GobbyWallet is required to use this application. If you haven't installed it yet, please click the button below:</p>
            <a href="https://www.goby.app/" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-lg" style="background-color: #4CAF50; border: none; padding: 15px 32px; font-size: 18px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); transition: all 0.3s;">
                <i class="fas fa-download me-2"></i> Install Goby Wallet
            </a>
            <p class="mt-4 text-muted">Once installed, refresh this page to connect your wallet.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`