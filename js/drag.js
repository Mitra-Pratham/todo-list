//drag & drop

// function onDragOverEvent(ev) {
//     ev.preventDefault();
//     let htmlID = $(ev.target).attr('id');
//     console.log(htmlID);
    
//     $(`#${htmlID} .drag-group`).show();
// }
// function onDragLeaveEvent(ev) {
//     ev.preventDefault();
//     let htmlID = $(ev.target).attr('id');
//     $(`#${htmlID} .drag-group`).hide();
// }
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
    let oldTaskId = fProp.value.slice(16);
    let oldDateId = fProp.value.slice(5,15);
    let newDateId = $(ev.target).attr('value');
    let newObj = '';
    console.log(oldTaskId, oldDateId, newDateId);
    
    taskArray.forEach(el => {
        if (el.id === oldDateId) {
           el.taskList.forEach(el => {
                
                if(el.id.slice(16) === oldTaskId){
                    newObj =  el;
                }
            });
        }
    });
    console.log(newObj);
   if(newDateId!=undefined && newObj!=undefined && newObj!='' && newDateId.length == oldDateId.length){
    deleteTasks(oldDateId, oldTaskId);
    createTask(newObj.name, newDateId, '', newObj.desc, newObj.statusCode);
   }
   $(`.drag-group`).hide();

}