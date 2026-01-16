// ---------- INIT ----------
$(document).ready(function () {
  $('#ARlevel').on('change', () => {
    $('#ARlevel').removeClass('is-invalid');
  });
});

// ---------- OPEN LIBRARY MODAL ----------
$(document).on('click', '#selectedCharacterImage', function () {
  console.log('Select character from Library');
  $('#libraryModal').modal('show');
  $('#libClear, #savechararcters').addClass('d-none');
});

// ---------- CHARACTER SELECT ----------
$(document).on('click', '.character-card', function () {
  const $item = $(this).closest('.library-item');

  let imgSrc        = $item.data('img-src');
  const charName    = $item.data('char-name');
  const element     = $item.data('element');
  const weaponType  = $item.data('weapon');
  const c_id        = $(this).data('char-id');

  if (!imgSrc) return;

  imgSrc = imgSrc.trim();

  console.log({ charName, c_id, element, weaponType, imgSrc });

  // Update UI
  $('#selectedCharacterImg')
    .attr('src', imgSrc)
    .attr('data-char-id', c_id);

  $('.selected-character-info').removeClass('d-none');

  $('#selectedCharacterName').text(capitalize(charName));
  $('#selectedCharacterelement').text(capitalize(element));
  $('#selectedCharacterWeaponType').text(capitalize(weaponType));

  $('#libClear, #savechararcters').removeClass('d-none');
  $('#libraryModal').modal('hide');
});

// ---------- ACTION BUTTONS ----------
$(document).on('click', '#suggestActions', function () {
  console.log('Suggest Actions button clicked');
  checkIsCharacterSelected();
});

$(document).on('click', '#evaluateTeam', function () {
  console.log('Evaluate Team button clicked');
  team_evaluation();
});

// ---------- VALIDATION ----------
function checkIsCharacterSelected() {
  const selectedCharSrc = $('#selectedCharacterImg').attr('src') || '';

  if (selectedCharSrc.includes('hand-drawn-question-mark-silhouette.png')) {
    bootstrap.Toast.getOrCreateInstance(
      document.getElementById('warningToast'),
      { delay: 3000 }
    ).show();
    return false;
  }
  arlv = $('#ARlevel').val();
  if (arlv == '' || arlv == null) {
    console.log(arlv);
    bootstrap.Toast.getOrCreateInstance(
      document.getElementById('warningToastAR'),
      { delay: 3000 }
    ).show();
  }

  LoadResultSection();
  return true;
}

// ---------- AJAX ----------
function team_evaluation() {
  console.log('Evaluating team...');
  $.ajax({
    url: '/api/team_evaluation',
    method: 'POST',
    dataType: 'json',
    success: function (res) {
      $('#team_eval')
        .removeClass('d-none')
        .html(res.data);
    }
  });
}

function LoadResultSection() {
  const c_id = $('#selectedCharacterImg').data('char-id');
  const arlv = $('#ARlevel').val();
  $.ajax({
    url: '/api/result_section',
    method: 'POST',
    data: { c_id, arlv },
    dataType: 'json',
    success: function (res) {
      $('#result_team-score_section').html(res.data);
    },
    error: function (xhr) {
      console.error('AJAX error', xhr.responseText);
    }
  });
}

// ---------- UTILS ----------
function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
