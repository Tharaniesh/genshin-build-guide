$(document).on('click', '#selectedCharacterImage', function () {
    console.log('Select character from Library');
    $('#libraryModal').modal('show');
    $
});

$(document).on('click', '#suggestActions', function () {
    console.log('Suggest Actions button clicked');
    checkIsCharacterSelected();
});

$(document).on('click', '#evaluateTeam', function () {
    console.log('Evaluate Team button clicked');
    team_evaluation();
    // Implement the logic to evaluate the team based on selected character
});

function checkIsCharacterSelected() {
    const selectedCharSrc = $('#selectedCharacterImg').attr('src');
    if (selectedCharSrc.includes('hand-drawn-question-mark-silhouette.png')) {
        console.log('Please select a character first.');
        return false;
    }   
    console.log('Character selected:', selectedCharSrc);
    // Proceed with suggesting actions
    suggestActionsForCharacter(selectedCharSrc);
    return true;
}

function suggestActionsForCharacter(characterSrc) {
    console.log('Suggesting actions for character with image source:', characterSrc);
    // Implement the logic to suggest actions based on the selected character
}

function team_evaluation() {
    console.log('Evaluating team...');
    $.ajax({
        url: '/api/team_evaluation',
        method: 'POST',
        dataType: 'json',
        success: function (res) {
            console.log('Team evaluation result:', res);
            $('#team_eval').removeClass('d-none');
            $('#team_eval').html(res.data);
        }
    });
}