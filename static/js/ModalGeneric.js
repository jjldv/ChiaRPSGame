class ModalGeneric{
    constructor(){
        this.Html = `
            <div class="modal fade" id="ModalGeneric" tabindex="-1" aria-labelledby="ModalGeneric" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="TitleModalGeneric"></h5>
                        <button type="button" class="btn-close" data-mdb-ripple-init data-mdb-dismiss="modal"
                            aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="BodyModalGeneric">
                    </div>
                </div>
            </div>
            </div>`
    }
    open(title,body){
        document.body.insertAdjacentHTML('beforeend', this.Html)
        document.getElementById("TitleModalGeneric").innerHTML = title
        document.getElementById("BodyModalGeneric").innerHTML = body
        new mdb.Modal(document.getElementById("ModalGeneric")).show()
        document.getElementById("ModalGeneric").addEventListener('hidden.bs.modal', function (event) {
            document.getElementById("ModalGeneric").remove()
        })
    }
}