fetch('./.html/navbar.html')
    .then(function (response) {
        return response.text();
    })
    .then(function (html) {
        $('#navbar-container').append(html);
    });

//function to replaceURLs in description
function replaceURLs(content) {
    if (!content) return;
    // This regex matches URLs starting with http://, https://, or www, or domain-like strings.
    // It also matches existing anchor tags so we can skip them.
    var urlRegex = /<a[\s\S]*?<\/a>|(((https?:\/\/)|(www\.))[\w-.]+|[\w-.]+\.(com|net|org|edu|gov|io|co|in|me|ai|dev))(\/[^\s]*)?/gi;

    return content.replace(urlRegex, function (match) {
        // If the match starts with '<a', it's already an anchor tag, return it as is.
        if (match.startsWith('<a')) {
            return match;
        }

        var url = match;
        var hyperlink = url;
        // Add http:// if the URL doesn't already start with http:// or https://
        if (!hyperlink.match(/^https?:\/\//)) {
            hyperlink = 'http://' + hyperlink;
        }
        return '<a href="' + hyperlink + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
}

// Expose functions to window for legacy scripts and HTML attributes
window.replaceURLs = replaceURLs;