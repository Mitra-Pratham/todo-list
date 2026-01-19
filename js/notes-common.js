const shortcutKeys = [
    {
        name: `Cut`,
        keys: `Ctrl + X`,
    },
    {
        name: `Copy`,
        keys: `Ctrl + C`,
    },
    {
        name: `Paste`,
        keys: `Ctrl + V`,
    },
    {
        name: `Bold`,
        keys: `Ctrl + B`,
    },
    {
        name: `Italics`,
        keys: `Ctrl + I`,
    },
    {
        name: `Unordered List and Sub Bullets`,
        keys: `Ctrl + Shift + 9`,
    },
    {
        name: `Ordered List and Sub Bullets`,
        keys: `Tab`,
    },
    {
        name: `Convert selection text to links`,
        keys: `Ctrl + K`,
    },
    {
        name: `Convert selection to code block`,
        keys: 'Ctrl + Shift + `',
    },
]
const headingsArray = [
    {
        name: `Heading 1`,
        value: `h1`,
    },
    {
        name: `Heading 2`,
        value: `h2`,
    },
    {
        name: `Heading 3`,
        value: `h3`,
    },
    {
        name: `Heading 4`,
        value: `h4`,
    },
    {
        name: `Heading 5`,
        value: `h5`,
    },
    {
        name: `Heading 6`,
        value: `h6`,
    },
    {
        name: `Paragraph`,
        value: `p`,
    },
]
const colorsArray = [
    {
        name: `Black`,
        value: `black`,
    },
    {
        name: `White`,
        value: `white`,
    },
    {
        name: `Red`,
        value: `red`,
    },
    {
        name: `Blue`,
        value: `blue`,
    },
    {
        name: `Green`,
        value: `green`,
    },
    {
        name: `Yellow`,
        value: `yellow`,
    },
]


const commonButtonClasses = `btn btn-lite-sm btn-no-bg-gray`;

//date sort in terms of ascending order
function bubbleSort(arr) {
    let n = arr.length;

    // Traverse through all array elements
    for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - 1 - i; j++) {
            // Swap if element is greater than next index
            let prevDate = new Date(arr[j].id).getTime();
            let newDate = new Date(arr[j + 1].id).getTime();
            if (prevDate > newDate) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
            }
        }
    }

    return arr;
}

function createShortcuts() {
    return (
        shortcutKeys.map((el) => {
            return `<div class="mb-1">${el.name}: <b>${el.keys}</b></div>`
        }).join(""));
}


function createButtons(array, color) {
    return (
        array.map((el) => {
            return `<button class="btn btn-lite-sm btn-no-bg d-flex" value="${el.value}">
                ${color ? colorAdd(el.value) : ''} ${color ? '' : el.name}<span class="btn-title">${el.name}</span></button>`
        }).join(""));

    function colorAdd(value) {
        return `<div value=${value} style="border:1px solid #ddd; border-radius:2px; height:14px; width:14px; background-color:${value}"></div>`
    }
}

function createRTFToolbar() {
    return `
        <div id="notes-formatter-row">
                <div id="rtf-buttons">
                    <button class="${commonButtonClasses} headings-box">
                    <i class="fa-solid fa-heading"></i>
                    <span class="btn-title">Heading</span>
                    </button>
                    <div id="headings-box-container" class="task-box-ui-layout">
                        ${createButtons(headingsArray)}
                    </div>

                    <button class="${commonButtonClasses} ol-box">
                    <i class="fa-solid fa-list-ol"></i>
                    <span class="btn-title">Ordered List - Ctrl + Shift + 9</span>
                    </button>

                    <button class="${commonButtonClasses} ul-box"">
                    <i class="fa-solid fa-list-ul"></i>
                    <span class=" btn-title">Unordered List - Tab</span>
                    </button>

                    <button class="${commonButtonClasses} colors-box">
                    <i class="fa-solid fa-font"></i>
                    <span class="btn-title">Font Color</span>
                    </button>
                    <div id="colors-box-container" class="task-box-ui-layout">
                        ${createButtons(colorsArray, true)}
                    </div>

                    <button class="${commonButtonClasses} background-box">
                    <i class="fa-solid fa-highlighter"></i>
                     <span class="btn-title">BG Color</span>
                    </button>
                    <div id="background-box-container" class="task-box-ui-layout">
                        ${createButtons(colorsArray, true)}
                    </div>

                    <button class="${commonButtonClasses} shortcuts-box">
                    <i class="fa-solid fa-keyboard"></i>
                    </button>
                    <div id="shortcuts-box-container" class="task-box-ui-layout">
                    <div class="fw-bold mb-2">Shortcuts</div>
                        ${createShortcuts()}
                    </div>

                </div>
                <div id="saved-box-message" class="toaster-message">Your notes have been saved</div>
            </div>
    `
}