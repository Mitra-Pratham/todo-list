//saving notes
$('#notes-detail-container').on('blur', '#notes-detail-area', function () {
    let pageID = $('#notes-detail-area').attr('value');
    saveText(pageID);
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

$('#notes-detail-container').on('click', '.page-tab', function (e) {
    let pageID = $(this).attr('id');
    let tempObj = findPage(pageID);
    renderNotesDetailHTML(tempObj);
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
