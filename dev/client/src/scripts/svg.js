export const svgTemplates = {
    fullscreen: null,
    muted: null,
    rotateScreen: null,
    settings: null,
    unmuted: null,
    windowed: null,
};

function findSvgTemplates() {
    for(const key of Object.keys(svgTemplates)) {
        svgTemplates[key] = document.getElementById(`svg-template-${key}`);
    }
}

function insertSvgElementsIntoDom() {
    document.querySelectorAll(".mute-toggle-btn").forEach(btn => btn.appendChild(getSvg("unmuted")));
    document.querySelectorAll(".fullscreen-toggle-btn").forEach(btn => btn.appendChild(getSvg("fullscreen")));
    document.querySelectorAll(".settings-btn").forEach(btn => btn.appendChild(getSvg("settings")));
    document.querySelectorAll("dialog.rotate-screen").forEach(dialog => dialog.insertBefore(getSvg("rotateScreen"), dialog.firstChild));
}

export function populateSvgs() {
    findSvgTemplates();
    insertSvgElementsIntoDom();
}

export function getSvg(name) {
    const $fragment = svgTemplates[name].content.cloneNode(true);
    const $svg = $fragment.querySelector("*");
    $svg.dataset.type = name;
    return $fragment;
}
