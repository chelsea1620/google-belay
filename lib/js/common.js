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
  makeCapDraggable: function(capServer, dirty) {
    return function(node, rc, generator) { 
      // TODO(arjun): highlight this element and all sinks
      node.attr('data-rc', rc);
      node.addClass('belay-cap-source');
      
      node.attr('draggable', true);
      
      node[0].addEventListener('dragstart', function(evt) {
				var saveGen = function(rc) {
					var result = generator(rc);
					dirty();
					return result;
				};
        var data = capServer.dataPreProcess(
          { rc: rc, gen: capServer.grant(saveGen) });
        evt.dataTransfer.effectAllowed = 'all';
        evt.dataTransfer.setData('Text', data);
      });
    };
  },

  makeCapDroppable: function(capServer, dirty) {
    return function(node, rc, accept) {
      node.attr('data-rc', rc);
      node.addClass('belay-possible');
      var preventDf = function(e) {
        e.originalEvent.preventDefault();
        return false;
      };
      node.bind('dragenter', preventDf);
      node.bind('dragover', preventDf);
      node[0].addEventListener('drop', function(evt) {
        var data;
        try {
          data =
            capServer.dataPostProcess(evt.dataTransfer.getData('Text'));
        }
        catch(_) {
          console.log('ignoring dropped nonsense',
            evt.dataTransfer.getData('Text'));
          evt.preventDefault();
          return;
        }

        if (!(rc === '*' || data.rc === rc)) {
          console.log('incompatible cap', data, 'accepting only', rc);
          evt.preventDefault();
          return;
        }
        data.gen.post(data.rc, function(cap) {
          accept(cap, data.rc);
          dirty();
        });
      });
    };
  }
};


