import {capitalizeFirstLetter} from "./util.js";

export class TextSelector {
    #cssSelector;
    #$domNodes;
    #validValues;
    #selectableValues;
    #currIdx;

    constructor(cssSelector, initialValue, validValues) {
        if(!cssSelector || typeof cssSelector !== "string") {
            console.error(`Invalid css selector ${cssSelector}`);
            return;
        }
        if(initialValue === undefined || initialValue === null || typeof initialValue !== "string") {
            console.error(`Invalid initial value passed for initialization of text selector ${cssSelector}`);
            return;
        }
        if(validValues === undefined || validValues === null || !Array.isArray(validValues) || validValues.length === 0) {
            console.error(`Invalid array of valid values passed for initialization of text selector ${cssSelector}`);
            return;
        }

        this.#currIdx = validValues.indexOf(initialValue);
        if(this.#currIdx === -1) {
            console.error(`Error during initialization of text selector ${cssSelector}: invalid initial value ${initialValue}, because array of valid values does not include initial value`);
            return;
        }

        this.#cssSelector = cssSelector;
        this.#$domNodes = document.querySelectorAll(cssSelector);
        this.#validValues = validValues;
        this.#selectableValues = validValues;

        for(const $node of this.#$domNodes) {
            $node.textContent = capitalizeFirstLetter(initialValue);
            $node.dataset.values = validValues.join(",");
            $node.onclick = () => TextSelector.onClick(this);
        }
    }

    static onClick(textSelector) {
        textSelector.#currIdx = (textSelector.#currIdx + 1) % textSelector.#selectableValues.length;

        for(const $node of textSelector.#$domNodes) {
            $node.textContent = capitalizeFirstLetter(textSelector.#selectableValues[textSelector.#currIdx]);
        }
    }

    getValue() {
        return this.#selectableValues[this.#currIdx];
    }

    updateSelectableValues(values) {
        if(values === undefined || values === null || !Array.isArray(values) || values.length === 0) {
            console.error(`Invalid array of values passed to update selectable values of text selector ${this.#cssSelector}`);
            return;
        }

        for(const value of values) {
            if(!this.#validValues.includes(value)) {
                console.error(`Invalid value ${value} passed to update selectable values of text selector ${this.#cssSelector}`);
                return;
            }
        }

        this.#selectableValues = values;
        for(const $node of this.#$domNodes) {
            $node.textContent = capitalizeFirstLetter(this.#selectableValues[0]);
        }
    }
}