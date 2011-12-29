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
  var isRunning;

  function init(cs, ib, ir) {
    capServer = cs;
    instanceBase = ib;
    isRunning = ir;
  }

  // TODO (iainmcgin): we could do with a more robust object abstraction for
  // the collection of instances, instead of just a map with some poorly
  // defined methods from the previous refactoring step.
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
         data: string  -- stored data for the instance
         section: string -- the section the instance belongs to
       },
       launch: {
          page: { html: url },
          info: any
          attributes: { set: cap }
       },
       row: node -- the row representing the instance in the section list
       closeCap : cap -- close the window
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


  function launchInstance(inst, launcher) {
    isRunning.post(inst.state.id, function(r) {
      if (r) {
        launcher.post({ close: true });
        return;
      }

      inst.state.belayInstance.get(function(launch) {
        inst.launch = launch;

        require('attributes').pushToInstance(inst);
        dirty(inst);
        // TODO(mzero): is pushing attributes and dirty really needed here?

        launcher.post({
          instanceId: inst.state.id,
          url: inst.launch.page.html, // TODO(iainmcgin): remove
          pageUrl: inst.launch.page.html,
          relaunch: capServer.grant(function(activate) {
            launchInstance(inst, activate);
          }),
          outpostData: {
            info: inst.launch.info,
            instanceId: inst.state.id,
            services: belayBrowser,
            setRefresh: capServer.grant(function(refreshCap) {
              inst.refreshCap = refreshCap;
            })
          }
        },
        function(closeCap) {
          inst.closeCap = closeCap;
        },
        function(error) {
          console.assert(false);
        });
      });
    });
  }

  var addInstance = function(inst) {
    instances[inst.state.id] = inst;
    require('sections').newInstance(inst);
  };

  // Called when a Web page that wants to morph into an instance.
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
        created: (new Date()).valueOf()
      }
    };
    addInstance(inst);
    launchInstance(inst, args.activate);
  };

  var forEach = function(visitor) {
    for (instanceId in instances) {
      visitor(instances[instanceId]);
    }
  }

  var getById = function(instanceId) {
    return instances[instanceId];
  };

  var deleteInstance = function(instanceId) {
    // TODO(iainmcgin): this is a very weak form of delete, that does not
    // affect any presentation aspects of the instance in the station.
    // sections.js is currently responsible for that, but clear ownership of
    // the delete activity for instances needs to be defined.
    delete instances[instanceId];
  };

  return {
    init: init,
    forEach: forEach,
    getById: getById,
    dirty: dirty,
    launchInstance: launchInstance,
    addInstance: addInstance,
    deleteInstance: deleteInstance,
    newInstHandler: newInstHandler
  };

});
