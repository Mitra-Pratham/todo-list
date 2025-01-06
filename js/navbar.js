fetch('./.html/navbar.html')
.then(function (response){
    return response.text();
})
.then (function(html){
    $('#navbar-container').append(html);
});