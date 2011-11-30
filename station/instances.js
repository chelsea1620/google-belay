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

define(['require'], function(require) {

  var capServer;
  var instanceBase;
  
  function init(cs, ib) {
    capServer = cs;
    instanceBase = ib;
  }
  
  //
  // Instance Data
  //
  var instances = Object.create(null);
  /*
    a map from instanceIds to
     {
       storageCap: cap,-- where station stores instance state (see next member)
       state: {
         id: uuid,
         belayInstance: cap(belay/instance),
         created: Int      -- time created (seconds since epoch)
         name: string,
         icon: url,
         opened: boolean, -- whether the instance is open or not
         data: string  -- stored data for the instance
         section: string -- the section the instance belongs to
       },
       launch: {
          page: { html: url },
          info: any
          attributes: { set: cap }
       },
       capServer: caps -- the cap server for this instance (if !state.remote)
       row: node -- the row representing the instance in the section list
       closeCap : cap -- present for windowed instances
     }
  */

  var dirtyInstances = [];
  
  function dirtyProcess() {
    var inst;
    while (!inst) {
      if (dirtyInstances.length <= 0) { return; }
      var instanceId = dirtyInstances.shift();
      inst = instances[instanceId];
    }
    inst.storageCap.post(inst.state, dirtyProcess);
  }
  function dirty(inst) {
    var instanceId = inst.state.id;
    if (dirtyInstances.indexOf(instanceId) >= 0) return;
    dirtyInstances.push(instanceId);
    if (dirtyInstances.length === 1)
      setTimeout(dirtyProcess, 1000);
  }
  function ensureSync(inst, k) {
    var ix = dirtyInstances.indexOf(inst.state.id);
    if (ix == -1) { k(); }
    else {
      dirtyInstances.splice(ix, 1);
      inst.storageCap.post(inst.state, k);
    }
  }


  function launchPageInstance(inst, launcher) {
    inst.state.opened = true;
    dirty(inst);

    inst.capServer = undefined;

    launcher.post({
      instanceId: inst.state.id,
      url: inst.launch.page.html, // TODO(iainmcgin): remove
      pageUrl: inst.launch.page.html,
      relaunch: capServer.grant(function(activate) {
        launchInstance(inst, 'relaunchpage', activate);
      }),
      outpostData: {
        info: inst.launch.info,
        instanceId: inst.state.id,
        services: belayBrowser,
        setRefresh: capServer.grant(function(refreshCap) {
          inst.refreshCap = refreshCap;
        }),
        notifyClose: capServer.grant(function() {
          closeInstHandler(inst.state.id);
        })
      }
    },
    function(closeCap) {
      inst.closeCap = closeCap;
    },
    function(error) {
      console.assert(false);
    });
  }

  function launchInstance(inst, openType, launcher) {
    var instState = inst.state;

    // TODO(mzero) create cap for storage to station
    // gets/puts from instState.data, and dirty(inst) on put

    dirty(inst);
    instState.belayInstance.get(function(launch) {
      inst.launch = launch;
      require('attributes').pushToInstance(inst);
      var canPage = 'page' in launch;

      var preferred = canPage ? 'page' : 'none';

      if (openType == 'restore') {
        if (instState.opened) {
          openType = 'none';
        } else {
          openType = preferred;
        }
      }
      else if (openType == 'openAny') {
        openType = preferred;
      }

      if (openType == 'closed' || openType == 'none') {
        // leave closed!
      }
      else if (openType == 'page' && canPage) {
        if (instState.opened) return;
        launchPageInstance(inst, launcher);
      } else if (openType == 'relaunchpage' && canPage) {
        launchPageInstance(inst, launcher);
      }
      else {
        alert('launchInstance: this instance cannot open as a ' + openType);
      }
    });
  }
  
  var addInstance = function(inst) {
    instances[inst.state.id] = inst;
    require('sections').newInstance(inst);
  };

  var removeInstance = function(inst) {
    if (inst.state.opened) {
      inst.closeCap.put();
    }
    require('sections').deleteInstance(inst);
  };

  // Called by Belay (the extension) when a user visits a Web page, P, that wants
  // to morph into an instance. The supplied launch cap has the same signature
  // as belayLaunch. Instead of creating a new tab, it reloads P's tab.
  var newInstHandler = function(args) {
    var instanceId = newUUIDv4();
    var inst = {
      storageCap: capServer.grant(instanceBase + instanceId),
      // TODO(arjun) still a hack. Should we be concatenaing URLs here?
      state: {
        id: instanceId,
        belayInstance: args.instanceDescription.launch,
        name: args.instanceDescription.name,
        icon: args.instanceDescription.icon,
        created: (new Date()).valueOf(),
      }
    };
    addInstance(inst);
    launchInstance(inst, 'page', args.activate);
  };

  var closeInstHandler = function(instanceId) {
    if (!(instanceId in instances)) return;

    var inst = instances[instanceId];
    if (inst.state.opened) {
      inst.state.opened = false;
      dirty(inst);
    }

    // Re-prime the link for launching.
    var newStartId = newUUIDv4();
    inst.row.find('td.actions .open-page').attr('target', newStartId);
    expectPage.post({
      startId: newStartId,
      ready: capServer.grant(function(activate) {
        launchInstance(inst, 'page', activate);
      })
    });
  };
  
  return {
    init: init,
    instances: instances,
    dirty: dirty,
    launchInstance: launchInstance,
    addInstance: addInstance,
    removeInstance: removeInstance,
    newInstHandler: newInstHandler,
    closeInstHandler: closeInstHandler,
  };

});
