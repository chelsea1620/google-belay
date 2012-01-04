// Copyright 2011 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

define([], function() {

  function detachProto(elem) {
    var proto = elem.eq(0).detach();
    proto.removeClass('proto');
    return proto;
  }

  function initInputsWithEmbeddedLabels(jqElems) {
    jqElems.each(function() {
      var elem = this;
      var input = $(elem);

      if (input.attr('type') == 'submit') return;

      var initialText = input.val();
      input.bind('focus mousedown', function() {
        if (elem.classList.contains('fresh')) {
          elem.classList.remove('fresh');
          input.val('');
        }
      });

      input.focusout(function() {
        if (input.val() == '' || input.val() == initialText) {
          elem.classList.add('fresh');
          input.val(initialText);
        }
      });

      input.bind('reset', function() {
        elem.classList.add('fresh');
        input.val(initialText);
      });
    });
  }

  function showDialog(dialog) {
    $('body').append($('<div>', { 'class': 'dark-screen'}));
    dialog.show();
    dialog.css('top', ($(window).height() - dialog.outerHeight()) / 2 + 'px');
    dialog.css('left', ($(window).width() - dialog.outerWidth()) / 2 + 'px');
  }

  function hideDialog(dialog) {
    $('.dark-screen').remove();
    dialog.hide();
  }

  return {
    detachProto: detachProto,
    initInputsWithEmbeddedLabels: initInputsWithEmbeddedLabels,
    showDialog: showDialog,
    hideDialog: hideDialog
  };
});

