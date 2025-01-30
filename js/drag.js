//drag & drop
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    let data = {
        value: $(ev.target).attr('value')
    }
    ev.dataTransfer.setData("text", JSON.stringify(data));
}

function drop(ev) {
    ev.preventDefault();
    let fName = ev.dataTransfer.getData("text");
    let fProp = JSON.parse(fName);
    let oldTaskId = fProp.value.slice(16);
    let oldDateId = fProp.value.slice(5,15);
    let newDateId = $(ev.target).attr('value');
    let newObj = '';
    taskArray.forEach(el => {
        if (el.id === oldDateId) {
           el.taskList.forEach(el => {
                console.log(el);
                
                if(el.id.slice(16) === oldTaskId){
                    newObj =  el;
                }
            });
        }
    });
   if(newDateId!=undefined && newObj!=undefined && newObj!=''){
    createTask(newObj.name, newDateId, '', newObj.desc, newObj.statusCode);
    deleteTasks(oldDateId, oldTaskId);
   }

}