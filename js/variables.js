
let taskArray = [];
const dbName = "TasksDB";
const storeName = "tasksData";
const  bsOffcanvas = new bootstrap.Offcanvas('#task-detail-container');

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
        name: `Convert text to links`,
        keys: `Ctrl + K`,
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