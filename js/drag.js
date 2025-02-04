function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    let data = {
        value: $(ev.target).attr('value')
    }
    ev.dataTransfer.setData("text", JSON.stringify(data));
    $(`.drag-group`).show();
}

function drop(ev) {
    ev.preventDefault();
    let fName = ev.dataTransfer.getData("text");
    let fProp = JSON.parse(fName);
    let oldTaskID = fProp.value.slice(16);
    let oldDateID = fProp.value.slice(5, 15);
    let newDateID = $(ev.target).attr('value');
    let newObj = findTask(oldDateID, oldTaskID);
    if (newDateID != undefined && newObj != undefined && newObj != '' && newDateID.length == oldDateID.length) {
        deleteTasks(oldDateID, oldTaskID);
        createTask(newObj.name, newDateID, '', newObj.desc, newObj.statusCode);
    }
    $(`.drag-group`).hide();

}