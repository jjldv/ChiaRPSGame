class FeeSelector {
    constructor(feeOptions, currencyCode ,containerId = 'feeSelectorContainer') {
        this.feeOptions = feeOptions;
        this.id = Math.random().toString(36).substr(2, 9);
        this.currencyCode = currencyCode.toUpperCase();
        this.container = document.getElementById(containerId);
        this.selectedValue = feeOptions[0].fee;
        this.selectedTime = feeOptions[0].time;
        this.isCustomMode = false;
        this.animationStart = null;
        this.animationRequestId = null;
        this.ANIMATION_DURATION = 30000; // 30 segundos

        // Event handlers
        this.changeHandlers = [];
        this.timerFinishedHandlers = [];

        if (this.container) {
            this.render();
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="fee-selector-wrapper">
                <div class="fee-select-container">
                    <select id="feeSelect" name="fee">
                        id="${this.id}_feeSelect"
                        ${this.feeOptions.map(option => `
                            <option value="${option.fee}" data-time="${option.time}">
                                ${option.fee} ${this.currencyCode} - ${option.time === -1 ? '(>5 min)' : `(~${option.time} min)`}
                            </option>
                        `).join('')}
                        <option value="custom">Enter a custom fee...</option>
                    </select>
                    <input type="text" id="customFeeInput" placeholder="Enter custom fee" 
                           style="display: none;"
                           value="${this.isCustomMode ? this.selectedValue : ''}">
                    <div class="fee-display">
                        <span class="fee-value">${this.selectedValue} ${this.currencyCode} - ${this.selectedTime === -1 ? '(>5 min)' : `(~${this.selectedTime} min)`}</span>
                    </div>
                    <div class="fee-dropdown-icon">▼</div>
                </div>
                <div class="fee-refresh-bar">
                    <div class="fee-refresh-progress"></div>
                </div>
            </div>
        `;
    
        this.setupEventListeners();
        this.startProgressAnimation();
    }

    setupEventListeners() {
        const select = document.getElementById('feeSelect');
        const customInput = document.getElementById('customFeeInput');
        const dropdownIcon = this.container.querySelector('.fee-dropdown-icon');
        const feeDisplay = this.container.querySelector('.fee-display');

        if (select) {
            select.addEventListener('change', this.handleSelectChange.bind(this));
        }
        if (customInput) {
            customInput.addEventListener('input', this.handleCustomInput.bind(this));
            customInput.addEventListener('blur', this.handleCustomInputBlur.bind(this));
        }
        if (dropdownIcon) {
            dropdownIcon.addEventListener('click', this.toggleDropdown.bind(this));
        }
        if (feeDisplay) {
            feeDisplay.addEventListener('click', this.toggleDropdown.bind(this));
        }
    }

    handleSelectChange(event) {
        const value = event.target.value;
        if (value === 'custom') {
            this.isCustomMode = true;
            this.showCustomInput();
        } else {
            this.isCustomMode = false;
            this.selectedValue = value;
            this.selectedTime = event.target.selectedOptions[0].dataset.time;
            this.hideCustomInput();
        }
        this.updateDisplayValue();
        this.triggerChangeEvent();
    }
    
    handleCustomInput(event) {
        this.selectedValue = event.target.value;
        this.selectedTime = 'Custom';
        this.updateDisplayValue();
        this.triggerChangeEvent();
    }
    
    handleCustomInputBlur(event) {
        if (event.target.value.trim() === '') {
            this.isCustomMode = false;
            this.selectedValue = this.feeOptions[0].fee;
            this.selectedTime = this.feeOptions[0].time;
            this.hideCustomInput();
        } else {
            this.selectedValue = event.target.value;
            this.selectedTime = 'Custom';
        }
        this.updateDisplayValue();
        this.triggerChangeEvent();
    }

    toggleDropdown() {
        const select = document.getElementById('feeSelect');
        if (!select) return;

        if (this.isCustomMode) {
            this.isCustomMode = false;
            this.selectedValue = this.feeOptions[0].fee;
            this.selectedTime = this.feeOptions[0].time;
            this.hideCustomInput();
            this.updateDisplayValue();
            select.selectedIndex = 0;
        }

        if (select.showPicker) {
            select.showPicker();
        } else {
            const event = new MouseEvent('mousedown', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            select.dispatchEvent(event);
        }
    }

    showCustomInput() {
        const customInput = document.getElementById('customFeeInput');
        const feeDisplay = this.container.querySelector('.fee-display');
        if (customInput && feeDisplay) {
            customInput.style.display = 'block';
            feeDisplay.style.display = 'none';
            customInput.focus();
        }
    }

    hideCustomInput() {
        const customInput = document.getElementById('customFeeInput');
        const feeDisplay = this.container.querySelector('.fee-display');
        if (customInput && feeDisplay) {
            customInput.style.display = 'none';
            feeDisplay.style.display = 'flex';
        }
    }

    updateDisplayValue() {
        const feeDisplay = this.container.querySelector('.fee-display');
        const select = document.getElementById('feeSelect');
        if (feeDisplay) {
            feeDisplay.innerHTML = `
                <span class="fee-value">${this.selectedValue} ${this.currencyCode} - ${this.selectedTime === -1 ? '(>5 min)' : this.selectedTime === 'Custom' ? '(Custom)' : `(~${this.selectedTime} min)`}</span>
            `;
        }
        if (select && !this.isCustomMode) {
            select.value = this.selectedValue;
        }
    }

    startProgressAnimation() {
        this.animationStart = Date.now();
        this.animateProgress();
    }

    animateProgress() {
        const progress = this.container.querySelector('.fee-refresh-progress');
        if (!progress) return;

        const elapsed = Date.now() - this.animationStart;
        const width = (elapsed / this.ANIMATION_DURATION) * 100;

        if (width <= 100) {
            progress.style.width = `${width}%`;
            this.animationRequestId = requestAnimationFrame(this.animateProgress.bind(this));
        } else {
            this.restartProgressAnimation();
            this.triggerTimerFinishedEvent();
        }
    }
    on(eventName, handler) {
        if (eventName === 'change') {
            this.changeHandlers.push(handler);
        } else if (eventName === 'timerFinished') {
            this.timerFinishedHandlers.push(handler);
        }
    }

    triggerChangeEvent() {
        const eventData = {
            value: this.selectedValue,
            time: this.selectedTime,
            isCustom: this.isCustomMode
        };
        this.changeHandlers.forEach(handler => handler(eventData));
    }

    triggerTimerFinishedEvent() {
        this.timerFinishedHandlers.forEach(handler => handler());
    }

    getCurrentValue() {
        return {
            value: this.selectedValue,
            time: this.selectedTime,
            isCustom: this.isCustomMode
        };
    }
    restartProgressAnimation() {
        if (this.animationRequestId) {
            cancelAnimationFrame(this.animationRequestId);
        }
        const progress = this.container.querySelector('.fee-refresh-progress');
        if (progress) {
            progress.style.width = '0%';
        }
        this.startProgressAnimation();
    }
}