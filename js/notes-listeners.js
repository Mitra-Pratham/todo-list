//saving notes
$('#notes-detail-container').on('blur', '#notes-detail-area' , function(){
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
