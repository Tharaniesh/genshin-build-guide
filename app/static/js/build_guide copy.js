
$(function () {
  // --- UI state (no pre-filled data) ---
  let slots = [];
  const MAX_SLOTS = 4;

  // cached template HTML (slot fragment returned by /slot_card)
  let _slotTemplateHtml = null;

  // ---------- TEMPLATE LOADER ----------
  // loads /slot_card (server returns the slot fragment HTML, with %%IDX%% tokens)
  function loadSlotTemplate() {
    return $.ajax({
      url: '/slot_card',
      method: 'GET',
      dataType: 'html',
      cache: false
    }).done(function(html) {
      _slotTemplateHtml = html;
    }).fail(function() {
      console.warn('Failed to load slot template from /slot_card — falling back to inline inputs.');
      _slotTemplateHtml = null;
    });
  }

  // ---------- UI renderers ----------
  // wrapper render that waits for template to be loaded before actual rendering
  function renderSlots(){
    if(_slotTemplateHtml === null){
      loadSlotTemplate().always(() => _renderSlotsCore());
    } else {
      _renderSlotsCore();
    }
  }

  // actual renderer (synchronous, uses cached template)
  function _renderSlotsCore(){
    const $container = $('#slotsArea');
    $container.empty();
    slots.forEach(s => $container.append(slotCardDOM(s)));
    $('#slotsCount').text(slots.length);
    if(slots.length <= 1){
      $("#eval").addClass("d-none");
    } else {
      $("#eval").removeClass("d-none");
    }
    if(slots.length === 0){
      $("#suggession").addClass("d-none");
    }else {
      $("#suggession").removeClass("d-none");
    }
  }

  // compact slot card DOM (template preferred, fallback inline)
  function slotCardDOM(s){
  // ensure slot has a place to store AC instances
  s._ac = s._ac || {};

  if(_slotTemplateHtml){
  const tpl = _slotTemplateHtml.replace(/%%IDX%%/g, s.idx);
  const $frag = $(tpl);

  // --- PREFILL values from slot object so re-renders keep the text ---
  const $charIn = $frag.find('.char-input');
  const $wepIn  = $frag.find('.wep-input');
  const $const  = $frag.find('.constellation-select');
  const $setType = $frag.find('.art-set-type');
  const $namesContainer = $frag.find('.art-names-container');

  if($charIn.length) $charIn.val(s.character || '');
  if($wepIn.length)  $wepIn.val(s.weapon || '');
  if($const.length)  $const.val((s.constellation != null) ? s.constellation : 0);
  // ensure setType numeric (default to 2)
  if($setType.length) $setType.val((s.setType != null) ? s.setType : 2);

  // wire remove button
  $frag.find('.remove-slot-btn').on('click', function(){ removeSlot(s.idx); });

  // CHAR input wiring + remote autocomplete
  $charIn.on('blur keydown', function(e){
    if(e.type === 'keydown' && e.key !== 'Enter') return;
    if(e.type === 'keydown') e.preventDefault();
    updateSlot(s.idx, { character: $(this).val().trim() });
  });
  if($charIn.length){
    if(s._ac.char && s._ac.char.destroy) s._ac.char.destroy();
    s._ac.char = attachAutocompleteRemote($charIn, { url:'/api/search', type:'char', delay:200, minLength:1 });
  }

  // WEAPON input wiring + remote autocomplete
  $wepIn.on('blur keydown', function(e){
    if(e.type === 'keydown' && e.key !== 'Enter') return;
    if(e.type === 'keydown') e.preventDefault();
    updateSlot(s.idx, { weapon: $(this).val().trim() });
  });
  if($wepIn.length){
    if(s._ac.wep && s._ac.wep.destroy) s._ac.wep.destroy();
    s._ac.wep = attachAutocompleteRemote($wepIn, { url:'/api/search', type:'wep', delay:200, minLength:1 });
  }

  // constellation
  if($const.length) $const.on('change', ()=> updateSlot(s.idx, { constellation: Number($const.val()) }));

  // artifact set type / names wiring
  if($setType.length){
    // render names using the slot's current artifactNames (prefilled)
    renderArtifactNameInputs($namesContainer, Number($setType.val()), s.artifactNames || []);

    // attach autocomplete for each created artifact input
    $namesContainer.find('input').each(function(){
      const $ai = $(this);
      const key = $ai.attr('id') || ('art_' + s.idx + '_' + Math.random().toString(36).slice(2,6));
      $ai.attr('id', key);
      // destroy any existing instance for this key defensively
      if(s._ac[key] && s._ac[key].destroy) { s._ac[key].destroy(); delete s._ac[key]; }
      s._ac[key] = attachAutocompleteRemote($ai, { url:'/api/search', type:'art', delay:200, minLength:1 });
    });

    // when setType changes, re-render name inputs and reattach AC
    $setType.on('change', function(){
      // IMPORTANT: get numeric value — make sure your template uses values "2" and "4"
      const stRaw = $(this).val();
      const st = Number(stRaw);                     // will be 2 or 4 if option values are "2" or "4"
      renderArtifactNameInputs($namesContainer, st, s.artifactNames || []);

      // destroy previous art AC instances for this slot (keys named art_*)
      Object.keys(s._ac || {}).forEach(k => {
        if(k.startsWith('art_') && s._ac[k] && s._ac[k].destroy){
          s._ac[k].destroy(); delete s._ac[k];
        }
      });

      $namesContainer.find('input').each(function(){
        const $ai = $(this);
        const key = $ai.attr('id') || ('art_' + s.idx + '_' + Math.random().toString(36).slice(2,6));
        $ai.attr('id', key);
        s._ac[key] = attachAutocompleteRemote($ai, { url:'/api/search', type:'art', delay:200, minLength:1 });
      });

      const names = collectArtifactNames($namesContainer);
      updateSlot(s.idx, { setType: st, artifactNames: names });
    });
  }

  // artifact name inputs update
  $frag.on('blur', '.art-names-container input', function(e){
    const names = collectArtifactNames($namesContainer);
    updateSlot(s.idx, { artifactNames: names });
  });

  // return wrapped fragment
  return $('<div>').addClass('col-12 col-md-6').append($frag);
}


  // fallback simple card (if template missing)
  const $card = $('<div>').addClass('slot-card d-flex gap-2');
  const $badge = $('<div>').addClass('slot-badge').text(s.idx);
  $card.append($badge);

  const $body = $('<div>').css('flex','1');
  const $top = $('<div>').addClass('d-flex justify-content-between align-items-center');
  $top.html(`<div style="font-weight:700">Slot ${s.idx}</div>`);
  const $rem = $('<button>').addClass('btn btn-sm btn-outline-danger').text('Remove').on('click', ()=> { removeSlot(s.idx); });
  $top.append($rem);
  $body.append($top);

  const $grid = $('<div>').addClass('mt-2 row g-2');

  // create fallback inputs and attach remote AC to them
  const $charWrap = formColEditable('Character', `char_${s.idx}`, [], s.character || '', v => updateSlot(s.idx, { character: v }));
  const $wepWrap  = formColEditable('Weapon', `wep_${s.idx}`, [], s.weapon || '', v => updateSlot(s.idx, { weapon: v }));
  const $artWrap  = formColEditable('Artifact', `art_${s.idx}`, [], s.artifact || '', v => updateSlot(s.idx, { artifact: v }));

  $grid.append($charWrap, $wepWrap, $artWrap);
  $grid.append(formColNumber('Constellation', `con_${s.idx}`, s.constellation, v => updateSlot(s.idx, { constellation: +v })));
  $body.append($grid);

  // attach remote AC for fallback inputs
  const $charInFb = $charWrap.find('input');
  if($charInFb.length){
    if(s._ac.char && s._ac.char.destroy) s._ac.char.destroy();
    s._ac.char = attachAutocompleteRemote($charInFb, { url:'/api/search', type:'char', delay:200, minLength:1 });
  }
  const $wepInFb = $wepWrap.find('input');
  if($wepInFb.length){
    if(s._ac.wep && s._ac.wep.destroy) s._ac.wep.destroy();
    s._ac.wep = attachAutocompleteRemote($wepInFb, { url:'/api/search', type:'wep', delay:200, minLength:1 });
  }
  const $artInFb = $artWrap.find('input');
  if($artInFb.length){
    // single artifact input for fallback (treat as art)
    const key = 'art_' + s.idx + '_fb';
    if(s._ac[key] && s._ac[key].destroy) s._ac[key].destroy();
    s._ac[key] = attachAutocompleteRemote($artInFb, { url:'/api/search', type:'art', delay:200, minLength:1 });
  }

  $card.append($body);
  return $('<div>').addClass('col-12 col-md-6').append($card);
}

  // helper: artifact name inputs
  function renderArtifactNameInputs($container, setType, names){
    $container.empty();
    if(setType === 2){
      const $r = $('<div>').addClass('d-flex gap-2');
      const $i0 = $('<input>').attr({type:'text', placeholder:'Art 1'}).addClass('form-control form-control-sm').val((names && names[0])||'');
      const $i1 = $('<input>').attr({type:'text', placeholder:'Art 2'}).addClass('form-control form-control-sm').val((names && names[1])||'');
      $r.append($i0, $i1); $container.append($r);
    } else {
      const $i = $('<input>').attr({type:'text', placeholder:'Artifact set name'}).addClass('form-control form-control-sm').val((names && names[0])||'');
      $container.append($i);
    }
  }
  function collectArtifactNames($container){
    return $container.find('input').map(function(){ return $(this).val().trim(); }).get();
  }

  // ---------- minimal fallback form builders ----------
  function formColEditable(label, id, optionsArr, value, onChange){
    const $wrap = $('<div>').addClass('col-6');
    const $labelEl = $('<label>').addClass('form-label small muted-sm').text(label);
    $wrap.append($labelEl);

    const $inputGroup = $('<div>').addClass('input-group');
    const $input = $('<input>').attr({ type: 'text', id, placeholder: `Type or pick ${label.toLowerCase()}` }).addClass('form-control form-control-sm').val(value || '');
    const listId = id + '_list';
    const $dl = $('<datalist>').attr('id', listId);
    optionsArr.forEach(opt => $dl.append($('<option>').val(opt)));
    $input.attr('list', listId);

    $input.on('keydown', function(ev) { if(ev.key === 'Enter'){ ev.preventDefault(); onChange($(this).val().trim()); }});
    $input.on('blur', function() { onChange($(this).val().trim()); });

    $inputGroup.append($input);
    const $append = $('<button>').attr('type','button').addClass('btn btn-sm btn-outline-secondary').html('<i class="bi bi-plus-lg"></i>').on('click', function() { onChange($input.val().trim()); });
    $inputGroup.append($append);
    $wrap.append($inputGroup); $wrap.append($dl);
    return $wrap;
  }

  function formColNumber(label, id, value, onChange){
    const $wrap = $('<div>').addClass('col-4');
    const $labelEl = $('<label>').addClass('form-label small muted-sm').text(label);
    $wrap.append($labelEl);
    const $input = $('<input>').attr({ type: 'number', id }).addClass('form-control form-control-sm').val(value ?? '');
    $input.attr('min', 0);
    $input.on('change', ()=> onChange($input.val()));
    $wrap.append($input);
    return $wrap;
  }

  // ---------- slot ops ----------
  function addSlot(){
    $("#btmactionbtn").removeClass("d-none");
  if(slots.length >= MAX_SLOTS) return;
  const idx = slots.length + 1;
  // create a clean slot object with AC container
  slots.push({ idx, character:'', weapon:'', artifactNames:[], constellation:0, setType:2, _ac: {} });
  logAction(`Added slot ${idx}`);
  renderSlots();
}

function removeSlot(idx){
  // find slot and destroy AC instances
  const slot = slots.find(s => s.idx === idx);
  if(slot && slot._ac){
    Object.keys(slot._ac).forEach(k => {
      try{ if(slot._ac[k] && slot._ac[k].destroy) slot._ac[k].destroy(); } catch(e){ /* ignore */ }
    });
    slot._ac = {};
  }

  // remove and reindex
  slots = slots.filter(s => s.idx !== idx);
  slots.forEach((s,i)=> s.idx = i+1);
  logAction(`Removed slot ${idx}`);
  renderSlots();
}

  function clearSlots(){ $('#btmactionbtn').addClass('d-none'); slots = []; logAction('Cleared all slots'); renderSlots(); }
  function updateSlot(idx, patch){ slots = slots.map(s => s.idx===idx ? Object.assign({}, s, patch) : s); renderSlots(); }

  // minimal logger (keeps a small recent actions list if present)
  function logAction(text){
    const $ul = $('#recentActions');
    if(!$ul.length) return;
    const $li = $('<li>').text(text);
    $ul.prepend($li);
    while($ul.children().length > 6) $ul.children().last().remove();
  }

  // ---------- bindings (only add/clear) ----------
  $('#addSlot').on('click', addSlot);
  $('#clearSlots').on('click', ()=> { clearSlots(); renderSlots(); });

  // initial template load + render
  loadSlotTemplate().always(()=> {
    renderSlots();
  });

});

(function($){
  // tiny debounce helper
  function debounce(fn, wait){
    let t;
    return function(...args){
      clearTimeout(t);
      t = setTimeout(()=> fn.apply(this, args), wait);
    };
  }

  // create a single dropdown container reused by all instances
  const $dd = $('<div class="autocomplete-list" style="display:none"></div>').appendTo('body');

  // normalize server response into array of strings
  function normalizeResponse(data){
    if(!data) return [];
    if(Array.isArray(data)) {
      // array of strings or objects
      if(data.length === 0) return [];
      if(typeof data[0] === 'string') return data;
      if(typeof data[0] === 'object' && data[0].name) return data.map(x => x.name);
    }
    // fallback: empty
    return [];
  }

  // attach remote autocomplete
  // opts: { url: '/api/search', type: 'char'|'wep'|'art', minLength: 1, delay: 250, maxResults: 12 }
  window.attachAutocompleteRemote = function($input, opts){
    opts = Object.assign({ url:'/api/search', type:'char', minLength:1, delay:250, maxResults:12, showOnFocus:false }, opts||{});
    const cache = new Map(); // simple cache for identical queries
    let visibleItems = [], selectedIndex = -1;

    function position() {
      const off = $input.offset();
      const h = $input.outerHeight();
      $dd.css({
        top: off.top + h + 8,
        left: off.left,
        minWidth: Math.max(180, $input.outerWidth()),
        display: 'block'
      });
    }
    function hide(){
      $dd.hide().empty();
      selectedIndex = -1;
      visibleItems = [];
    }

    function showList(items, term){
      $dd.empty();
      visibleItems = items;
      selectedIndex = -1;
      if(!items || items.length === 0){
        $dd.append($('<div class="autocomplete-noresults">No matches</div>'));
        position();
        return;
      }
      items.slice(0, opts.maxResults).forEach((it, i) => {
        const $item = $('<div class="autocomplete-item">').attr('data-idx', i).text(it);
        $item.on('mousedown', function(e){ e.preventDefault(); choose(i); });
        $dd.append($item);
      });
      position();
    }

    function choose(i){
      if(typeof i !== 'number') i = selectedIndex;
      if(i < 0 || i >= visibleItems.length) return;
      $input.val(visibleItems[i]).trigger('input').trigger('change');
      hide();
      $input.focus();
    }

    function onKey(e){
      if(!$dd.is(':visible')) return;
      const items = $dd.find('.autocomplete-item');
      if(e.key === 'ArrowDown'){ e.preventDefault(); selectedIndex = Math.min(selectedIndex+1, items.length-1); items.removeClass('active').eq(selectedIndex).addClass('active').get(0)?.scrollIntoView({block:'nearest'}); return; }
      if(e.key === 'ArrowUp'){ e.preventDefault(); selectedIndex = Math.max(selectedIndex-1, 0); items.removeClass('active').eq(selectedIndex).addClass('active').get(0)?.scrollIntoView({block:'nearest'}); return; }
      if(e.key === 'Enter'){ e.preventDefault(); choose(selectedIndex >= 0 ? selectedIndex : 0); return; }
      if(e.key === 'Escape'){ hide(); return; }
    }

    // remote fetch (debounced)
    const doFetch = debounce(function(q){
      if(!q || q.length < opts.minLength){
        // if you want top suggestions when empty: request with q empty. For now hide.
        hide();
        return;
      }
      const cacheKey = opts.type + '::' + q.toLowerCase();
      if(cache.has(cacheKey)){ showList(cache.get(cacheKey), q); return; }

      $.ajax({
        url: opts.url,
        data: { q: q, type: opts.type },
        dataType: 'json',
        method: 'GET',
        cache: false,
      }).done(function(data){
        const arr = normalizeResponse(data);
        cache.set(cacheKey, arr);
        showList(arr, q);
      }).fail(function(){ showList([], q); });
    }, opts.delay);

    // events
    $input.attr('autocomplete', 'off');
    $input.on('input.remoteAC', function(){
      const q = $(this).val();
      if(q && q.length >= opts.minLength) doFetch(q);
      else hide();
    });
    $input.on('keydown.remoteAC', onKey);
    $input.on('blur.remoteAC', function(){ setTimeout(()=> hide(), 120); });

    if(opts.showOnFocus){
      $input.on('focus.remoteAC', function(){
        const q = $(this).val();
        if(q && q.length >= opts.minLength) doFetch(q);
      });
    }

    // reposition on scroll/resize
    $(window).on('resize.remoteAC scroll.remoteAC', function(){ if($dd.is(':visible')) position(); });

    // API to update options / destroy
    return {
      destroy: function(){
        $input.off('.remoteAC');
        $(window).off('.remoteAC');
        hide();
      },
      clearCache: function(){ cache.clear(); }
    };
  };

})(jQuery);



(function($){
  // --- Utility: safe text setter ---
  function setText(selector, text) {
    const $el = $(selector);
    if ($el.length) $el.text(text == null ? '' : text);
  }

  // --- gatherSlotData: fixed and correct ---
  function gatherSlotData(){
    const slotData = [];
    $('#slotsArea').children().each(function(){
      const $slot = $(this);
      const char = $slot.find('.char-input').val().trim();
      const weap = $slot.find('.wep-input').val().trim();

      const constel = Number($slot.find('.constellation-select').val() || 0);
      const setType = Number($slot.find('.art-set-type').val() || 0);
      const artNames = [];
      $slot.find('.art-names-container input').each(function(){
        artNames.push($(this).val().trim());
      });

      // push per slot inside the loop
      slotData.push({
        character: char,
        weapon: weap,
        constellation: constel,
        setType: setType,
        artifactNames: artNames
      });
    });
    return slotData;
  }

  // --- UI population helpers (adjust selectors to match your markup) ---
  function populateSummary(data){
    // expected: data.archetype, data.top_suggestion (object), data.composite_score
    setText('#teamArchetype', data.archetype || '—');
    // show badge text
    const $badge = $('#suggestionBadge');
    if (data.top_suggestion) {
      $badge.removeClass('d-none').text(data.top_suggestion.c_name || data.top_suggestion.name || 'Top Suggestion');
      $('#applyTopSuggestion').prop('disabled', false).data('suggestion', data.top_suggestion);
    } else {
      $badge.addClass('d-none').text('');
      $('#applyTopSuggestion').prop('disabled', true).removeData('suggestion');
    }
  }

  function populateComposite(data){
    // expected: data.composite_score (0-100), data.metrics.damage/energy/survival
    const score = Number(data.composite_score || 0);
    $('#compositeScoreBar').css('width', Math.max(0, Math.min(100, score)) + '%');
    setText('#compositeScoreLabel', score ? score + '%' : '');
    setText('#metricDamage', data.metrics && data.metrics.damage ? data.metrics.damage : '—');
    setText('#metricEnergy', data.metrics && data.metrics.energy ? data.metrics.energy : '—');
    setText('#metricSurvival', data.metrics && data.metrics.survival ? data.metrics.survival : '—');
  }

  function populateCharacters(list){
    // expected: list of objects { c_id, c_slug, c_name, role, analysis }
    const $container = $('#charactersList');
    $container.empty();
    if (!Array.isArray(list) || list.length === 0) {
      $container.append('<div class="text-muted">No characters entered</div>');
      return;
    }
    list.forEach(item => {
      const html = `
        <div class="card mb-2">
          <div class="card-body p-2 d-flex align-items-start">
            <div class="me-3">
              <img src="/static/portraits/${item.c_slug || 'unknown'}.png" alt="${item.c_name}" style="width:56px;height:56px;border-radius:8px;">
            </div>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between">
                <strong>${item.c_name || 'Unknown'}</strong>
                <small class="text-muted">${item.role || ''}</small>
              </div>
              <div class="small text-muted">${item.analysis || 'No analysis available.'}</div>
            </div>
          </div>
        </div>`;
      $container.append(html);
    });
  }

  function populateRecent(recent){
    const $rc = $('#recentActions');
    $rc.empty();
    if (!Array.isArray(recent) || recent.length === 0) {
      $rc.append('<div class="text-muted">No recent actions</div>');
      return;
    }
    recent.forEach(r => {
      $rc.append(`<div class="small text-muted mb-1">${r.when || r.ts || ''} — ${r.action || r.text || ''}</div>`);
    });
  }

  function populateRotationModal(suggestions){
    // suggestions expected: array of suggestion objects with rotation etc.
    const $tbody = $('#rotationNotesTbody');
    $tbody.empty();
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      $tbody.append('<tr><td colspan="4" class="text-muted">No rotation notes</td></tr>');
      return;
    }
    suggestions.forEach(s => {
      const char = s.c_name || s.name || '-';
      const role = s.role || '-';
      const rotation = Array.isArray(s.rotation) ? s.rotation.join(' → ') : (s.rotation || '-');
      const notes = s.notes || s.analysis || '';
      $tbody.append(`
        <tr>
          <td><a href="/build_guide?char=${encodeURIComponent(s.c_slug || s.slug || '')}">${char}</a></td>
          <td>${role}</td>
          <td>${rotation}</td>
          <td class="small text-muted">${notes}</td>
        </tr>`);
    });
  }

  // --- click handler: send slots, update UI ---
  $('#suggession').on('click', function(e){
    e.preventDefault();
    const slots = gatherSlotData();
    // simple validation: at least one filled slot
    const anyFilled = slots.some(s => s.character || s.weapon || (s.artifactNames && s.artifactNames.some(Boolean)) || s.role);
    if (!anyFilled) {
      alert('Please enter at least one character or weapon in the slots before requesting suggestions.');
      return;
    }

    // visual loading state
    $('#suggession').prop('disabled', true).addClass('disabled').text('Analyzing…');

    $.ajax({
      url: '/suggestion',           // change to your route
      method: 'POST',
      contentType: 'application/json; charset=utf-8',
      dataType: 'json',
      data: JSON.stringify({ slots: slots }),
      success: function(res){
        //   archetype: "X",
        //   composite_score: 77,
        //   metrics: {damage: 40, energy: 70, survival: 50},
        //   top_suggestion: {...},
        //   suggestions: [...],
        //   recent_actions: [...]
        // safety: if server wrapped error
        if (res && res.error) {
          console.error('Suggestion error:', res.error);
          alert('Server error: ' + res.error);
          return;
        }

        // populate all card sections
        populateSummary(res);
        populateComposite(res);
        populateCharacters(res.suggestions || []);
        populateRecent(res.recent_actions || []);
        populateRotationModal(res.suggestions || []);

        // open rotation modal if you want to show it immediately (optional)
        if (res.openRotationModal) {
          if (typeof bootstrap !== 'undefined') {
            const modalEl = document.getElementById('rotationNotesModal');
            const bsModal = new bootstrap.Modal(modalEl, {});
            bsModal.show();
          }
        }

        // optionally show "Apply Top Suggestion" highlight or toast
        if (res.top_suggestion) {
          // example: flash a small toast or animate the badge
        }
      },
      error: function(xhr, status, err){
        console.error('AJAX error', status, err, xhr.responseText);
        alert('Failed to fetch suggestions. See console for details.');
      },
      complete: function(){
        $('#suggession').prop('disabled', false).removeClass('disabled').text('Get Suggestions');
      }
    });
  });

  // --- apply top suggestion button handler ---
  $('#applyTopSuggestion').on('click', function(){

  });

})(jQuery);
