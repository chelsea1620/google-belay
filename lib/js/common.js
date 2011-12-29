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

/*
 * This file contains code that is shared between station and
 * page instances.
 */

var common = {
  makeCapDraggable: function(capServer) {
    return function(node, rc, genCap, imgurl) {
      node.attr('data-rc', rc);
      node.addClass('belay-cap-source');

      node.attr('draggable', true);

      node.bind('dragstart', function(evt) {
        var evt = evt.originalEvent;
        node.addClass('belay-selected');
        belayBrowser.highlightByRC.put({ className: 'belay-cap-target',
                                         rc: rc });
        var data = capServer.dataPreProcess(
          { rc: rc, gen: genCap });
        evt.dataTransfer.effectAllowed = 'all';

        var transferData = btoa(unescape(encodeURIComponent(data)));
        var dragImg;
        if (typeof imgurl === 'string') dragImg = imgurl;
        else if (typeof imgurl === 'function') dragImg = imgurl();
        else throw 'capDraggable: Bad imgurl';

        // TODO(jpolitz): clients of draggable could insert scripts here...
        var imgHTML = '<img src="' + dragImg +
            '" data ="' + transferData + '"/>';
        // TODO(jpolitz): the setDragImage should work, but doesn't in Chrome 13
        evt.dataTransfer.setDragImage($(imgHTML)[0], 0, 0);
        evt.dataTransfer.setData('text/html', imgHTML);
      });

      node.bind('dragend', function(_) {
        belayBrowser.unhighlight.put();
        node.removeClass('belay-selected');
      });
    };
  },

  makeCapDroppable: function(capServer) {
    return function(node, rc, accept) {
      node.attr('data-rc', rc);
      node.addClass('belay-cap-target');
      node.hover(
        function() {
          node.addClass('belay-selected');
          belayBrowser.highlightByRC.put({ className: 'belay-cap-source',
                                           rc: rc });
        },
        function() {
          node.removeClass('belay-selected');
          belayBrowser.unhighlight.put();
        });
      var preventDf = function(e) {
        e.originalEvent.preventDefault();
        return false;
      };

      node.bind('dragenter', function(evt) {
        evt = evt.originalEvent;
        if (node.hasClass('belay-possible')) {
          node.addClass('belay-selected');
        }
        evt.preventDefault();
        return false;
      });
      node.bind('dragleave', function(evt) {
        evt = evt.originalEvent;
        node.removeClass('belay-selected');
      });
      node.bind('dragover', preventDf);
      node[0].addEventListener('drop', function(evt) {
        var data;
        var jsonData;
        var elt;
        var html;
        try {
          html = evt.dataTransfer.getData('text/html');
          elt = $(html);
          var jsonData = elt.filter('img[data]').attr('data') ||
                         elt.find('img[data]').attr('data');

          // NOTE(jpolitz): gmail likes to append http:// to data attrs. If
          // that is present, chop it off.  This is a hack.  Thankfully, BCAP
          // encoded data cannot start with this string, since it's JSON.
          if (jsonData.indexOf('http://') === 0) {
            jsonData = jsonData.slice(7);
          }
          jsonData = decodeURIComponent(escape(atob(jsonData)));
          data = capServer.dataPostProcess(jsonData);
        }
        catch (e) {
          evt.preventDefault();
          return;
        }

        if (!(rc === '*' || data.rc === rc)) {
          evt.preventDefault();
          return;
        }
        accept(data.gen, data.rc);
      });
    };
  }
};

if (typeof define === 'function' && define.amd) {
  define(common);
}
