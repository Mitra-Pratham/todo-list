//saving notes
$('#notes-detail-container').on('blur', '#notes-detail-area', function () {
    let pageID = $('#notes-detail-area').attr('value');
    saveText(pageID,true,false);
});

//headings box toggle
$('#notes-detail-container').on('mousedown', '.headings-box, .colors-box, .background-box', function (e) {

    e.preventDefault();
    if ($(this).hasClass('headings-box')) {
        $('.headings-box').toggleClass('btn-no-bg-gray-active');
        $('#headings-box-container').toggle();
    }
    else if ($(this).hasClass('colors-box')) {
        $('.colors-box').toggleClass('btn-no-bg-gray-active');
        $('#colors-box-container').toggle();
    }
    else if ($(this).hasClass('background-box')) {
        $('.background-box').toggleClass('btn-no-bg-gray-active');
        $('#background-box-container').toggle();
    }
});

//common function to set background color, font color and heading based on selection
function getSelectionInsertNode(type, value) {
    let HTMLElement = '';
    let sel = window.getSelection();
    let range = sel.getRangeAt(0);
    switch (type) {
        case 'heading':
            {
                HTMLElement = document.createElement(`${value}`);
                HTMLElement.innerHTML = `${sel.toString()}`;
            }
            break;
        case 'color':
            {
                HTMLElement = document.createElement(`span`);
                HTMLElement.innerText = `${sel.toString()}`;
                HTMLElement.style.color = value;
            }
            break;
        case 'background':
            {
                HTMLElement = document.createElement(`span`);
                HTMLElement.innerText = `${sel.toString()}`;
                HTMLElement.style.backgroundColor = value;
            }
            break;

        default:
            break;
    }
    
    range.deleteContents();
    range.insertNode(HTMLElement);
}

//adding headings to notes area
$('#notes-detail-container').on('mousedown', '#headings-box-container button', function (e) {
    //get cursor position
    e.preventDefault();
    let heading = $(this).attr('value');
    let focus = $('#notes-detail-area').is(':focus');
    if (focus === true) {
        getSelectionInsertNode('heading', heading);
    }
    else {
        let headingElement = `<${heading}>Heading ${heading.slice(1, 2)}</${heading}>`;
        $('#notes-detail-area').append(headingElement);

    }
    let pageID = $('#notes-detail-area').attr('value');
    saveText(pageID,true,false);
    $('#headings-box-container').hide();
    $('.headings-box').removeClass('btn-no-bg-gray-active');
});

//adding color to selected font
$('#notes-detail-container').on('mousedown', '#colors-box-container button' , function (e) {
    e.preventDefault();
    let color = $(this).attr('value');
    let focus = $('#notes-detail-area').is(':focus');
    if (focus === true) {
        getSelectionInsertNode('color', color);
    }
    let pageID = $('#notes-detail-area').attr('value');
    saveText(pageID,true,false);
    $('#colors-box-container ').hide();
    $('.colors-box').removeClass('btn-no-bg-gray-active');

});

//adding background color to selected font
$('#notes-detail-container').on('mousedown', '#background-box-container button' , function (e) {
    e.preventDefault();
    let bg = $(this).attr('value');
    let focus = $('#notes-detail-area').is(':focus');
    if (focus === true) {
        getSelectionInsertNode('background', bg);
    }
    let pageID = $('#notes-detail-area').attr('value');
    saveText(pageID,true,false);
    $('#background-box-container ').hide();
    $('.background-box').removeClass('btn-no-bg-gray-active');

});

//adding sections
$('#notes-detail-container').on('click', '.add-sections-box', function (e) {
    let val = $(this).attr('value');
    // let textAreaID = $('.active-area').attr('id');
    addSections(val);
});

//create page function
$('#notes-detail-container').on('click', '#createPage', function (e) {
    createPage();
});

//import page function
$('#notes-detail-container').on('click', '#importPage', async function () {
    let fileHandle;
    [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    const fileHandleName = await fileHandle.name;
    const fileName = fileHandleName.substr(0, fileHandleName.lastIndexOf('.'));
    const contents = await file.text();
    createPage(contents, fileName);
});

//navigate to page
$('#notes-detail-container').on('click', '.page-tab', function (e) {
    let pageID = $(this).attr('id');
    let tempObj = findPage(pageID);
    renderNotesDetailHTML(tempObj);
});

//right click menu for pages
$('#notes-detail-container').on('contextmenu', '.page-tab', function(e){
    e.preventDefault();
    let tempEL = $(this).next();
    let tempElOpen = tempEL.hasClass('section-open');
    $('.section-open').hide().removeClass('section-open');
    if(!tempElOpen){
        tempEL.show().addClass('section-open');
    }
});

//deleting pages event listener
$('#notes-detail-container').on('click', '.delete-page', function(e){
    let pageID = $(this).parent().attr('value');
    deletePage(pageID);
});

//renamaing the page event listener
$('#notes-detail-container').on('click', '.rename-page', function(e){
    let pageID = $(this).parent().attr('value');
    let currentName = $(this).parent().prev().text().trim();
    let newName = prompt('Rename the page', currentName);
    if(newName !==null){
        saveText(pageID,false,newName);
    }
});

//get filehandle for export
async function getNewFileHandle(fileName) {
    const options = {
        suggestedName: fileName,
        startIn: 'downloads',
        types: [
            {
                description: 'Text Files',
                accept: {
                    'text/plain': ['.html'],
                },
            },
        ],
    };
    const handle = await window.showSaveFilePicker(options);
    return handle;
}

async function writeFile(fileHandle, contents) {
    // Create a FileSystemWritableFileStream to write to.
    const writable = await fileHandle.createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
}

//exporting the page
$('#notes-detail-container').on('click', '.export-page', function(e){
    let pageID = $(this).parent().attr('value');
    let pageItem = findPage(pageID);
    let currentName = $(this).parent().prev().text().trim();
    let fileContents = pageItem.html;
    getNewFileHandle(currentName).then((result) => {
        writeFile(result, fileContents);
        $('.section-open').hide().removeClass('section-open');
    })
});

//keypress listener here for notes area
$('#notes-detail-container').on('keydown', '#notes-detail-area', function (e) {
    //get cursor position
    let sel = window.getSelection();
    let range = sel.getRangeAt(0);


    switch (e.keyCode) {
        case 9:
            {
                e.preventDefault();
                let ulElement = document.createElement('ul');
                ulElement.innerHTML = '<li></li>'
                range.insertNode(ulElement);
                range.selectNodeContents(ulElement);
                sel.removeAllRanges();
                sel.addRange(range);
                break;
            }


        case 57:
            if (e.ctrlKey) {
                let sel = window.getSelection();
                let olElement = document.createElement('ol');
                olElement.innerHTML = '<li></li>'
                range.insertNode(olElement);
                range.selectNodeContents(olElement);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            break;

        case 75:
            if (e.ctrlKey) {
                e.preventDefault();
                let anchorTag = document.createElement('span');
                let anchorLink = prompt('please enter URL here', 'https://google.com');
                if (anchorLink) {
                    anchorTag.innerHTML = `<a href=${anchorLink} target="_blank">${sel.toString()}</a>`
                    range.deleteContents();
                    range.insertNode(anchorTag);
                }
            }
            break;

        case 192:
            if (e.ctrlKey) {
                e.preventDefault();
                let codeTag = document.createElement('code');
                codeTag.innerHTML = `${sel.toString()}`
                range.deleteContents();
                range.insertNode(codeTag);
            }
            break;

        default:
            break;
    }

});
