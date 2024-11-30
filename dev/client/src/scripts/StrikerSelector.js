import {MAX_USERS_PER_ROOM} from "./global.js";

export class StrikerSelector {
    #cssSelector;
    $domNodes;
    #validValues;
    selectableValues;
    currIdx;

    static onClick(strikerSelector) {
        strikerSelector.currIdx = (strikerSelector.currIdx + 1) % strikerSelector.selectableValues.length;

        for(const $node of strikerSelector.$domNodes) {
            const className = `striker${strikerSelector.selectableValues[strikerSelector.currIdx]}`;
            const circle = $node.querySelector("circle");
            circle.classList.remove(circle.classList.item(0));
            circle.classList.add(className);
        }
    }

    constructor(cssSelector, initialIdx) {
        if(!cssSelector || typeof cssSelector !== "string") {
            console.error("Invalid css selector");
            return;
        }
        if(initialIdx === undefined || initialIdx === null || typeof initialIdx !== "number" || MAX_USERS_PER_ROOM <= initialIdx) {
            console.error("Invalid initial value passed in for text selector initialization");
            return;
        }

        this.#cssSelector = cssSelector;
        this.$domNodes = document.querySelectorAll(cssSelector);
        const values = [];
        for(let i=0; i<MAX_USERS_PER_ROOM; i++) {
            values[i] = i;
        }
        this.#validValues = values;
        this.selectableValues = values;
        this.currIdx = initialIdx;

        for(const $node of this.$domNodes) {
            $node.onclick = () => StrikerSelector.onClick(this);
        }
    }

    getValue() {
        return this.selectableValues[this.currIdx];
    }

    updateSelectableValues(values) {
        if(values === undefined || values === null || !Array.isArray(values) || values.length === 0) {
            console.error(`Invalid array of values passed to update selectable values of striker selector ${this.#cssSelector}`);
            return;
        }

        for(const value of values) {
            if(MAX_USERS_PER_ROOM <= value) {
                console.error(`Invalid value ${value} passed to update selectable values of striker selector ${this.#cssSelector}`);
                return;
            }
        }

        this.selectableValues = values;
        for(const $node of this.$domNodes) {
            const className = `striker${this.selectableValues[0]}`;
            const circle = $node.querySelector("circle");
            circle.classList.remove(circle.classList.item(0));
            circle.classList.add(className);
        }
    }
}